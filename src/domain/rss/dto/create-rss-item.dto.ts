import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'

// 40 hex or 32 base32 chars: the two infohash encodings parse-torrent accepts.
export const MAGNET_PATTERN = /^magnet:\?xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/
const TITLE_MAX_LENGTH = 500

export class CreateRssItemDto {
  @ApiProperty({ example: '[SubsPlease] Frieren - 01 (1080p)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title must not be empty' })
  @MaxLength(TITLE_MAX_LENGTH, { message: `title must have at most ${TITLE_MAX_LENGTH} characters` })
  title: string

  @ApiProperty({ example: 'magnet:?xt=urn:btih:<40 hex or 32 base32>' })
  @IsString({ message: 'magnet must be a string' })
  @Matches(MAGNET_PATTERN, {
    message: 'magnet must be a magnet link like magnet:?xt=urn:btih:<40 hex or 32 base32 chars>',
  })
  magnet: string
}
