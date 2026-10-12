import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)

export class DateFormatter {
  static diff(date: number | Date, date2: number | Date, unit: 'hour' | 'minute' | 'day' = 'hour'): number {
    return dayjs(date).diff(dayjs(date2), unit)
  }

  static format(date: Date | string, format: string): string {
    return dayjs(date).format(format)
  }

  static toDate(date: string, format: string): Date {
    return dayjs(date, format).toDate()
  }
}
