import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { Device } from '../entities/device.entity';
import { User } from '../../users/entities/user.entity';
import { AuthStrategy, AuthResult } from '../interfaces/auth-strategy.interface';
import { SUPER_ADMIN_PROFILE_ID } from '../../../commons/constants';
import { StructuredLogger } from '../../../commons/logger/structured-logger.service';

@Injectable()
export class PasskeyAuthStrategy implements AuthStrategy {
  constructor(
    @InjectRepository(Device) private deviceRepo: Repository<Device>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private config: ConfigService,
    private logger: StructuredLogger,
  ) {}

  async getRegistrationOptions(userId: string) {
    const user = await this.userRepo.findOneByOrFail({ id: userId });
    const existingDevices = await this.deviceRepo.find({ where: { userId } });

    this.logger.info('auth.passkey.register.options', {
      userId,
      rpID: this.config.get('WEBAUTHN_RP_ID'),
      deviceCount: existingDevices.length,
    });

    return generateRegistrationOptions({
      rpName: this.config.get('WEBAUTHN_RP_NAME')!,
      rpID: this.config.get('WEBAUTHN_RP_ID')!,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      excludeCredentials: existingDevices.map((d) => ({
        id: d.credentialId,
        type: 'public-key' as const,
      })),
    });
  }

  async verifyRegistration(
    userId: string,
    response: any,
    expectedChallenge: string,
    deviceName?: string,
  ) {
    this.logger.info('auth.passkey.register.verify.start', {
      userId,
      deviceName,
      responseType: { type: response?.type, id: typeof response?.id === 'string' ? response.id.slice(-8) : null },
    });

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.config.get('WEBAUTHN_ORIGIN')!,
      expectedRPID: this.config.get('WEBAUTHN_RP_ID')!,
    });

    if (!verification.verified || !verification.registrationInfo) {
      this.logger.error('auth.passkey.register.verify.failed', {
        userId,
        verified: verification.verified,
        hasInfo: !!verification.registrationInfo,
        error: (verification as any)?.error ?? null,
        origin: this.config.get('WEBAUTHN_ORIGIN'),
        rpID: this.config.get('WEBAUTHN_RP_ID'),
      });
      throw new UnauthorizedException('No se pudo verificar el registro del dispositivo');
    }

    const { credentialID, credentialPublicKey, counter, aaguid } = verification.registrationInfo;

    await this.deviceRepo.save(
      this.deviceRepo.create({
        userId,
        // @simplewebauthn/server v10 devuelve credentialID como Base64URLString
        credentialId: credentialID,
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        deviceName: deviceName ? deviceName.slice(0, 120) : null,
      }),
    );

    this.logger.info('auth.passkey.register.verify.ok', {
      userId,
      credentialId: typeof credentialID === 'string' ? credentialID.slice(-8) : null,
      aaguid,
      counter,
      deviceName: deviceName ? deviceName.slice(0, 120) : null,
    });

    return { verified: true };
  }

  async getAuthenticationOptions(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    const devices = user ? await this.deviceRepo.find({ where: { userId: user.id } }) : [];

    return generateAuthenticationOptions({
      rpID: this.config.get('WEBAUTHN_RP_ID')!,
      allowCredentials: devices.map((d) => ({ id: d.credentialId, type: 'public-key' as const })),
    });
  }

  async authenticate(
    credentials: { response: any; expectedChallenge: string; email: string },
  ): Promise<AuthResult> {
    const user = await this.userRepo.findOne({
      where: { email: credentials.email },
    });
    const device = user
      ? await this.deviceRepo.findOne({
          where: { credentialId: credentials.response.id, userId: user.id },
        })
      : null;

    if (!user || !device) throw new UnauthorizedException('Passkey inválida');

    const verification = await verifyAuthenticationResponse({
      response: credentials.response,
      expectedChallenge: credentials.expectedChallenge,
      expectedOrigin: this.config.get('WEBAUTHN_ORIGIN')!,
      expectedRPID: this.config.get('WEBAUTHN_RP_ID')!,
      authenticator: {
        credentialID: device.credentialId,
        credentialPublicKey: Buffer.from(device.publicKey, 'base64url'),
        counter: device.counter,
      },
    });

    if (!verification.verified) throw new UnauthorizedException('Passkey inválida');

    device.counter = verification.authenticationInfo.newCounter;
    await this.deviceRepo.save(device);

    return {
      userId: user.id,
      companyId: user.profileId === SUPER_ADMIN_PROFILE_ID ? null : user.companyId,
      permissionsVersion: user.permissionsVersion,
    };
  }
}
