import {
  IsOptional,
  IsString,
  IsArray,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterMangaDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by genres (comma-separated)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v: string) => v.trim()) : value,
  )
  genres?: string[];

  @ApiPropertyOptional({
    enum: ['ongoing', 'completed', 'hiatus', 'cancelled'],
  })
  @IsOptional()
  @IsIn(['ongoing', 'completed', 'hiatus', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ description: 'Text search on title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by language code (e.g. en, ar)',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['title', 'views', 'rating', 'updatedAt', 'createdAt'],
    default: 'updatedAt',
  })
  @IsOptional()
  @IsIn(['title', 'views', 'rating', 'updatedAt', 'createdAt'])
  sortBy?: string = 'updatedAt';
}
