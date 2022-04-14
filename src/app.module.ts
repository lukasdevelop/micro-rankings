import { Module } from '@nestjs/common';
import { RankingsModule } from './rankings/rankings.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ProxyRMQModule } from './proxyrmq/proxyrmq.module';

@Module({
  imports: [
    RankingsModule,
    ConfigModule.forRoot({isGlobal: true}),
    MongooseModule.forRoot('mongodb+srv://nodeaws:LucasAmaral7@cluster0.i75j4.mongodb.net/srranking?retryWrites=true&w=majority'),
    ProxyRMQModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
