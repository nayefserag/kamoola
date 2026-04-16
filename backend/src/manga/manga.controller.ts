import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MangaService } from './manga.service';
import { FilterMangaDto } from './dto/filter-manga.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-objectid.pipe';

@ApiTags('Manga')
@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of manga with filters' })
  findAll(@Query() query: FilterMangaDto) {
    return this.mangaService.findAll(query);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get most popular manga by views' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findPopular(@Query('limit') limit?: number) {
    return this.mangaService.findPopular(limit || 10);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get recently updated manga' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findLatest(@Query('limit') limit?: number) {
    return this.mangaService.findLatest(limit || 10);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search manga by title' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(
    @Query('q') q: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.mangaService.search(q, page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get manga by ID (increments view count)' })
  @ApiParam({ name: 'id', description: 'Manga ObjectId' })
  findById(@Param('id', ParseObjectIdPipe) id: string) {
    return this.mangaService.findById(id);
  }
}
