import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Partida } from './interfaces/partida.interface';
import { Ranking } from './interfaces/ranking.schema'
import { Model } from 'mongoose'
import { RpcException } from '@nestjs/microservices';
import { ClientProxySmartRanking } from '../proxyrmq/client-proxy'
import { Categoria } from './interfaces/categoria.interface';
import { EventoNome } from './evento-nome-enum'


@Injectable()
export class RankingsService {

    constructor(
        @InjectModel('Ranking') private readonly desafioModel: Model<Ranking>,
        private clientProxySmartRanking: ClientProxySmartRanking
    ) { }

    private readonly logger = new Logger(RankingsService.name)

    private clientAdminBackend = this.clientProxySmartRanking.getClientProxyAdminBackendInstance()


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
}
