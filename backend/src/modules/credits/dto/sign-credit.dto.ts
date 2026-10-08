import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Contacto que el asesor confirma con el cliente antes de enviar a firma (paso 3). */
export class SignCreditDto {
  @Transform(trim)
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(254)
  email: string;

  /** Solo dígitos (7 a 15), con '+' opcional para indicativo. */
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value))
  @Matches(/^\+?\d{7,15}$/, { message: 'El teléfono debe tener entre 7 y 15 dígitos' })
  phone: string;

  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'La dirección debe tener entre 5 y 200 caracteres' })
  address: string;
}
