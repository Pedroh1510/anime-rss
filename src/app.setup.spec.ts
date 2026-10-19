import { resolvePort } from './app.setup'

describe('resolvePort', () => {
  it('usa 3033 quando nenhuma variável está definida', () => {
    expect(resolvePort({})).toBe(3033)
  })

  it('prefere PORT sobre o legado port', () => {
    expect(resolvePort({ PORT: '3000', port: '4000' })).toBe(3000)
  })

  it('aceita o legado port minúsculo', () => {
    expect(resolvePort({ port: '4000' })).toBe(4000)
  })

  it('rejeita valor inválido citando o valor recebido', () => {
    expect(() => resolvePort({ PORT: 'abc' })).toThrow('Invalid port "abc": expected integer 1-65535')
  })
})
