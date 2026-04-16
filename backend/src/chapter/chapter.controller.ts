import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChapterService } from './chapter.service';
import { ParseObjectIdPipe } from '../common/pipes/parse-objectid.pipe';

@ApiTags('Chapters')
@Controller()
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get('manga/:mangaId/chapters')
  @ApiOperation({ summary: 'Get paginated chapters for a manga' })
  @ApiParam({ name: 'mangaId', description: 'Manga ObjectId' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findByManga(
    @Param('mangaId', ParseObjectIdPipe) mangaId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chapterService.findByManga(mangaId, page || 1, limit || 50);
  }

  @Get('chapters/:id')
  @ApiOperation({ summary: 'Get a single chapter with pages' })
  @ApiParam({ name: 'id', description: 'Chapter ObjectId' })
  findById(@Param('id', ParseObjectIdPipe) id: string) {
    return this.chapterService.findById(id);
  }
}
