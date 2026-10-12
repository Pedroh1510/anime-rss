import { Transform } from '@json2csv/node'
import { Injectable } from '@nestjs/common'
import csvParser from 'csv-parser'

@Injectable()
export class CsvService {
  jsonToCsvStream({
    delimiter = '|',
    objectMode = false,
    decodeStrings = false,
    ndjson = false,
  }: {
    delimiter?: string
    objectMode?: boolean
    decodeStrings?: boolean
    ndjson?: boolean
    streamData?: any
  }): Transform<any, any> {
    return new Transform(
      { delimiter, ndjson, header: true, eol: '\n', formatters: { string: (a: string) => a } },
      { objectMode },
      { objectMode, decodeStrings }
    )
  }

  csvToJson(): any {
    return csvParser({ separator: '|' })
  }
}
