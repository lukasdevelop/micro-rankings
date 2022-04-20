import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Partida } from './interfaces/partida.interface';
import { Ranking } from './interfaces/ranking.schema'
import { Model } from 'mongoose'
import { RpcException } from '@nestjs/microservices';
import { ClientProxySmartRanking } from '../proxyrmq/client-proxy'
import { Categoria } from './interfaces/categoria.interface';
import { EventoNome } from './evento-nome-enum'
import { RankingResponse } from './interfaces/ranking-response.interface';
import * as momentTimezone from 'moment-timezone'
import { Desafio } from './interfaces/desafio.interface'

@Injectable()
export class RankingsService {

    constructor(
        @InjectModel('Ranking') private readonly desafioModel: Model<Ranking>,
        private clientProxySmartRanking: ClientProxySmartRanking
    ) { }

    private readonly logger = new Logger(RankingsService.name)

    private clientAdminBackend = this.clientProxySmartRanking.getClientProxyAdminBackendInstance()

    private clientDesafios = this.clientProxySmartRanking.getClientProxyDesafiosInstance()


    async processarPartida(idPartida: string, partida: Partida): Promise<void> {
        //this.logger.log(`idPartida: ${idPartida} partida: ${JSON.stringify(partida)}`)

        try {
            const categoria: Categoria = await this.clientAdminBackend.send('consultar-categorias', partida.categoria).toPromise()

            await Promise.all(partida.jogadores.map(async jogador => {

                const ranking = new this.desafioModel()

                ranking.categoria = partida.categoria
                ranking.desafio = partida.desafio
                ranking.partida = idPartida
                ranking.jogador = jogador

                if (jogador == partida.def) {

                    const eventoFilter = categoria.eventos.filter(
                        evento => evento.nome == EventoNome.VITORIA
                    )

                    ranking.evento = EventoNome.VITORIA
                    ranking.operacao = eventoFilter[0].operacao
                    ranking.pontos = eventoFilter[0].valor
                    //ranking.evento = 'VITORIA'
                    //ranking.pontos = 30
                   // ranking.operacao = '+'
                } else {
                    const eventoFilter = categoria.eventos.filter(
                        evento => evento.nome == EventoNome.DERROTA
                    )
                    ranking.evento = EventoNome.DERROTA
                    ranking.operacao = eventoFilter[0].operacao
                    ranking.pontos = eventoFilter[0].valor
                    //ranking.evento = 'DERROTA'
                    //ranking.pontos = 0
                   // ranking.operacao = '+'

                }

                this.logger.log(`ranking: ${JSON.stringify(ranking)}`)

                await ranking.save()

            }))

        } catch (error) {
            this.logger.error(`error: ${error}`)
            throw new RpcException(error.message)
        }
    }

    async consultarRankings(idCategoria: any, dataRef: string): Promise<RankingResponse[] | RankingResponse>{

        try{

            this.logger.log(`idCategoria: ${idCategoria} dataRef: ${dataRef}`)

            if(!dataRef) {
                dataRef = momentTimezone().tz("America/Sao_Paulo").format('YYYY-MM-DD')
                this.logger.log(`dataRef: ${dataRef}`)
            }

            const registrosRanking = await this.desafioModel.find()
            .where('categoria')
            .equals(idCategoria)
            .exec()

            this.logger.log(`registrosRanking: ${JSON.stringify(registrosRanking)}`)

            const desafios: Desafio[] = await this.clientDesafios.send('consultar-desafios-realizados', {
                idCategoria: idCategoria, dataRef: dataRef
            }).toPromise()

            
            return

        } catch (error){
            this.logger.error(`error: ${JSON.stringify(error.message)}`)
            throw new RpcException(error.message)
        }
    }
}
