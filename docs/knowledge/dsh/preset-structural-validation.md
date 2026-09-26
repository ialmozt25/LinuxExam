# Пресет DSH: структурная валидация важнее SHA256

Дата: 2026-09-26
Контекст: M2.5a выявила регрессию, которую SHA256-сверка не поймала.

## Инцидент

В M2.2c-2 (создание agent.cordis.yml для QC-пресета) метод вставки новой строки
в блок prefix заменил существующую строку suffix вместо вставки рядом. Общее
число строк не изменилось (114 = 114), проблема не была замечена ни в M2.2c-2,
ни в M2.2c-3, ни в M2.2d.

В M2.5a pre-flight: SHA256 source↔reference дал 6/6 match — потому что
reference-копия в репо байт-в-байт повторяла тот же дефектный файл.
SHA256 — целостность, НЕ корректность. Копия защищает от потери файла,
но не от порчи его содержимого.

Проблему поймал js-yaml: cfg_keys вместо prefix,suffix дал только prefix.

## Чек-лист структурной валидации пресета DSH

После любых правок agent.cordis.yml (или preset.yml, или скиллов) проверить:

1. js-yaml load с обходом !!js → !!str (только в памяти).
2. agent.cordis.yml — YAML-массив объектов - id: <name>.
   Object.keys() даст ['0','1',...]; доступ через doc.find(x => x.id === 'persona').
3. count top-level items = ожидаемое число (для QC = 17).
4. persona.config keys = prefix, suffix (ОБЯЗАТЕЛЬНО оба).
5. suffix value содержит {{cwd}}.
6. prefix содержит маркеры роли, модели, скиллов.
7. customSkillDirs присутствует.
8. Все остальные tool/plugin-секции не потеряны.

## Мини-скрипт (Node)

    const yaml = require(process.argv[2]);
    const fs = require('fs');
    let text = fs.readFileSync(process.argv[3], 'utf8');
    text = text.replace(/!!js/g, '!!str');
    const doc = yaml.load(text);
    const ids = doc.map(x => x.id).filter(Boolean);
    console.log('count=' + ids.length);
    const pItem = doc.find(x => x.id === 'persona');
    const cfg = pItem.persona || pItem.config || pItem;
    console.log('cfg_keys=' + Object.keys(cfg).join(','));
    console.log('suffix=' + (cfg.suffix || ''));
    console.log('has_cwd=' + (cfg.suffix || '').includes('{{cwd}}'));

## Ловушка подсчёта строк (in-line, найдена там же)

`-split "`n"` даёт РАВНОЕ число элементов количеству реальных строк, если файл
заканчивается на LF (последний элемент — пустая строка после финального LF).
Формула «realLines = splitLen - 1 при trailing LF» даёт ошибку на −1 и маскирует
потерянные/лишние строки. Правильно: проверять дельту через splitLen, а
`endsWith("`n")` учитывать отдельно. Инцидент 114=114 — ровно этот класс ошибок:
сдвиг на одну строку не виден, если сравнивать только итоговое число строк.

## Связанные

- temp-node-require-pitfall.md — require(process.argv[2]) для js-yaml из %TEMP%.
- preset-common-errors.md — общие ошибки пресетов.
- append-content-pitfalls.md — потеря \n при записи.
