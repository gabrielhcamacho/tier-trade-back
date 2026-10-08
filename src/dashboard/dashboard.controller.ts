import { Controller, Get, Headers, HttpCode, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Identity, type RequestIdentity, RequestIdentityGuard } from '../auth/request-identity.guard.js';
import { DashboardQueryService } from './dashboard-query.service.js';

@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(RequestIdentityGuard)
@Controller('v1/dashboards')
export class DashboardController {
  constructor(@Inject(DashboardQueryService) private readonly dashboards: DashboardQueryService) {}

  @Get()
  async all(
    @Identity() identity: RequestIdentity,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const result = await this.dashboards.all(identity.tenantId, identity.actorId);
    return this.respond(result, ifNoneMatch, response);
  }

  @Get(':module')
  async one(
    @Identity() identity: RequestIdentity,
    @Param('module') module: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const result = await this.dashboards.one(identity.tenantId, identity.actorId, module);
    return this.respond(result, ifNoneMatch, response);
  }

  @Post(':module/refresh')
  @HttpCode(202)
  refresh(@Identity() identity: RequestIdentity, @Param('module') module: string) {
    return this.dashboards.requestRefresh(identity.tenantId, identity.actorId, module);
  }

  private respond(result: { etag: string; body: unknown }, ifNoneMatch: string | undefined, response: FastifyReply) {
    response.header('etag', result.etag);
    response.header('cache-control', 'private, max-age=5, stale-while-revalidate=30');
    if (ifNoneMatch === result.etag) {
      response.status(304);
      return undefined;
    }
    return result.body;
  }
}
