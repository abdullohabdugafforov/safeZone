import en from './locales/en';
import ru from './locales/ru';
import uz from './locales/uz';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('translations', () => {
  it.each([
    ['uz', uz],
    ['ru', ru],
  ])('%s has exactly the same keys as en', (_lang, locale) => {
    expect(keys(locale).sort()).toEqual(keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const locale of [en, ru, uz]) {
      expect(keys(locale).length).toBeGreaterThan(0);
      expect(JSON.stringify(locale)).not.toContain('""');
    }
  });
});
