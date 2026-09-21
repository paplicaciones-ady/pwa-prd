import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ConfigModule as AppConfigModule } from './modules/config/config.module';
import { CreditsModule } from './modules/credits/credits.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './modules/redis/redis.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ModulePlacementsModule } from './modules/placements/module-placements.module';
import { CalculatorModule } from './modules/calculator/calculator.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PromosModule } from './modules/promos/promos.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { PricesModule } from './modules/prices/prices.module';
import { NewProductsModule } from './modules/new-products/new-products.module';
import { RoutesModule } from './modules/routes/routes.module';
import { BrainModule } from './modules/brain/brain.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { MetricsMiddleware } from './modules/metrics/metrics.middleware';
import { CsrfMiddleware } from './commons/middlewares/csrf.middleware';
import { envValidationSchema } from './commons/config/env.validation';
import { TenantContextInterceptor } from './commons/interceptors/tenant-context.interceptor';
import { LoggerModule } from './commons/logger/logger.module';
import { StructuredLogger } from './commons/logger/structured-logger.service';
import { CorrelationIdMiddleware } from './commons/middlewares/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        // Si se define DB_APP_USER/DB_APP_PASSWORD, el runtime se conecta con
        // un rol de aplicación NO owner (RLS realmente activo). Las migraciones
        // se ejecutan como DB_USER (owner) — ver docker-compose.prod.yml.
        username: config.get('DB_APP_USER') || config.get('DB_USER'),
        password: config.get('DB_APP_PASSWORD') || config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        // Pool de conexiones acotado + timeouts de query/statement: el clásico
        // "DB lenta → conexiones acumuladas → RAM↑ → contenedor muere" se corta
        // con límites explícitos (ISO 27001 A.12.6.1).
        poolSize: config.get<number>('DB_POOL_SIZE', 10),
        extra: {
          max: config.get<number>('DB_POOL_SIZE', 10),
          connectionTimeoutMillis: config.get<number>('DB_CONNECTION_TIMEOUT_MS', 5000),
          query_timeout: config.get<number>('DB_QUERY_TIMEOUT_MS', 10000),
          statement_timeout: config.get<number>('DB_STATEMENT_TIMEOUT_MS', 12000),
          idle_in_transaction_session_timeout: config.get<number>('DB_IDLE_TX_TIMEOUT_MS', 15000),
        },
      }),
    }),
    LoggerModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        // Límite general de defensa en profundidad (Kong ya aplica 100/min en producción).
        name: 'default',
        ttl: 60000,
        limit: 300,
      },
    ]),
    RedisModule,
    RbacModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    AppConfigModule,
    CreditsModule,
    FeatureFlagsModule,
    ModulePlacementsModule,
    CalculatorModule,
    CatalogModule,
    PromosModule,
    ReportsModule,
    PortfolioModule,
    DiscountsModule,
    SurveysModule,
    ExpensesModule,
    ComplaintsModule,
    PricesModule,
    NewProductsModule,
    RoutesModule,
    BrainModule,
    HealthModule,
    MetricsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Se declaran aquí para que sus dependencias (StructuredLogger) se
    // inyecten correctamente en los middlewares aplicados en configure().
    StructuredLogger,
    CorrelationIdMiddleware,
    MetricsMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(CsrfMiddleware).forRoutes('*');
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
