import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Partida } from './interfaces/partida.interface';
import { Ranking } from './interfaces/ranking.schema'
import { Model } from 'mongoose'
import { RpcException } from '@nestjs/microservices';
import { ClientProxySmartRanking } from '../proxyrmq/client-proxy'
import { Categoria } from './interfaces/categoria.interface';
import { EventoNome } from './evento-nome-enum'
import { RankingResponse, Historico } from './interfaces/ranking-response.interface';
import * as momentTimezone from 'moment-timezone'
import { Desafio } from './interfaces/desafio.interface'
import * as _ from 'lodash'

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

            _.remove(registrosRanking, function(item) {
                return desafios.filter(desafio => desafio._id == item.desafio).length == 0
            })

            this.logger.log(`registrosRanking: ${JSON.stringify(registrosRanking)}`)

            const resultado = _(registrosRanking)
                                .groupBy('jogador')
                                .map((items, key) => ({
                                    'jogador': key,
                                    'historico': _.countBy(items, 'evento'),
                                    'pontos': _.sumBy(items, 'pontos')
                                }))
                                .value()

            const resultadoOrdenado = _.orderBy(resultado, 'pontos', 'desc')
            this.logger.log(`resultado: ${JSON.stringify(resultadoOrdenado )}`)

            const rankingResponseList: RankingResponse[] = []

            resultadoOrdenado.map(function(item, index) {
                const rankingResponse: RankingResponse = {}

                rankingResponse.jogador = item.jogador
                rankingResponse.posicao = index + 1
                rankingResponse.pontuacao = item.pontos

                const historico: Historico = {}

                historico.vitorias = item.historico.VITORIA ? item.historico.VITORIA : 0
                historico.derrotas = item.historico.DERROTA ? item.historico.DERROTA : 0
                rankingResponse.historicoPartidas = historico

                rankingResponseList.push(rankingResponse)

                return rankingResponseList


            })


            return 

        } catch (error){
            this.logger.error(`error: ${JSON.stringify(error.message)}`)
            throw new RpcException(error.message)
        }
    }
}
