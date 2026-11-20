'use strict';
// Генерация тестового XLSX: 92 000 строк, номера в смешанных форматах, дубли и мусор.
// Запуск: node test/gen-xlsx.js [путь] [строк]
const XLSX = require('xlsx');

const NAMES = ['Айгуль', 'Нурлан', 'Анна', 'Ержан', 'Мадина', 'Сергей', 'Дана', 'Тимур', 'Алия', 'Олег'];
const CITIES = ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Ташкент'];
const JUNK = ['', 'нет телефона', '12345', '+7 (701) 12', 'abc', '0000000', '7701'];

function generate(total = 92000) {
  const rows = [['ФИО', 'Телефон', 'Город', 'Сумма']];
  const expected = { rows: total, unique: 0, duplicates: 0, invalid: 0 };
  const uniques = [];
  for (let i = 0; i < total; i++) {
    const name = NAMES[i % NAMES.length];
    const city = CITIES[i % CITIES.length];
    let cell;
    if (i % 46 === 45) {
      cell = JUNK[i % JUNK.length]; // ~2% мусора
      expected.invalid++;
    } else if (i % 23 === 22 && uniques.length) {
      // ~4% дублей — тот же номер в другом формате
      const d = uniques[(i * 7) % uniques.length];
      cell = d.startsWith('7') && d.length === 11 ? `8 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : `+${d}`;
      expected.duplicates++;
    } else {
      const n = String(1000000 + i).padStart(7, '0');
      let digits;
      if (i % 10 === 9) {
        digits = `99890${n}`; // Узбекистан
        cell = i % 20 === 9 ? `90${n}` : `+998 90 ${n.slice(0, 3)} ${n.slice(3)}`;
      } else {
        const op = ['701', '702', '705', '707', '747', '771', '775', '777', '778'][i % 9];
        digits = `7${op}${n}`;
        switch (i % 6) {
          case 0: cell = `+7 (${op}) ${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`; break;
          case 1: cell = `8${op}${n}`; break;
          case 2: cell = Number(`8${op}${n}`); break; // число, как часто бывает в Excel
          case 3: cell = `${op}${n}`; break; // 10 цифр
          case 4: cell = Number(digits); break;
          default: cell = `8 ${op} ${n}`;
        }
      }
      uniques.push(digits);
      expected.unique++;
    }
    rows.push([`${name} ${i}`, cell, city, (i % 500) * 100]);
  }
  return { rows, expected };
}

function writeXlsx(file, total) {
  const { rows, expected } = generate(total);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'База');
  XLSX.writeFile(wb, file, { compression: true });
  return expected;
}

module.exports = { generate, writeXlsx };

if (require.main === module) {
  const file = process.argv[2] || 'test-92k.xlsx';
  const expected = writeXlsx(file, Number(process.argv[3] || 92000));
  console.log(`Готово: ${file}`, expected);
}
