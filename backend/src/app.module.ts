import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DistanceModule } from './distance/distance.module';
import { ConfigModule, ConfigService } from '@nestjs/config';  // Added ConfigService import
import { HttpModule } from "@nestjs/axios";
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { DistanceService } from './distance/distance.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ParkingLot, ParkingLotSchema } from './parking-lot.schema';
import { ParkingUpdateService } from './parking-update.service';
import { InferenceService } from './inference/inference.service';
import { InferenceController } from './inference/inference.controller';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: 'ParkingDB',  // Explicitly set the database name
      }),
      inject: [ConfigService],
    }),
    HttpModule, 
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' 
    }),
    ScheduleModule.forRoot(),
    // Change MONGO_URI to MONGODB_URI to match your .env file
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost/parking'),
    MongooseModule.forFeature([
      { name: ParkingLot.name, schema: ParkingLotSchema },
    ]),
    DistanceModule
  ],
  controllers: [AppController, InferenceController],
  providers: [AppService, DatabaseService, DistanceService, ParkingUpdateService, InferenceService],
})
export class AppModule {}
