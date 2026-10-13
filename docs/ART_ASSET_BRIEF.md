# Оригинальный арт Ninja Climb 2.0

Инструмент: **встроенный image_gen**, 15 исходных PNG. Генерация доступна; в игру подключены настоящие растровые кадры, а не технический визуализатор. Исходники находятся в `docs/art-source/`, финальные ресурсы — в `public/assets/`. CLI/API fallback не использовался.

## Модель и стиль

Оригинальный атлетичный разведчик: индиговая ткань, маска, светлая повязка, тёмные собранные волосы, асимметричная бамбуковая защита, длинный раздвоенный алый шарф, тонкая катана с бронзовой гардой. Рисованная тушь и cel-живопись, складки ткани, тёплая обводка света и прохладные тени. Пропорции и силуэт отличаются от коммерческих референсов.

Костюмы: ember — исходный алый шарф/бамбук; jade — капюшон, нефритовая одежда, короткая светлая накидка и деревянные наручи; moon — светлые полы, жёлтый шарф, серебряные пластины и лунная заколка. Одежда действительно перерисована, без изменения экономики.

## Подключённые кадры

| Объект | Последовательности | Кадры | Runtime |
| --- | --- | --- | --- |
| Каждый из 3 героев | idle, run, jump, rise, fall, land, cling, slide, wall-jump, dash, attack, hurt, death | 13 × 4 = 52 | characters/{id}.png + {id}-combat.png |
| Теневой страж | idle, patrol, windup, slash, recover, hurt, death | 7 × 4 = 28 | enemies/sentinel.png |
| Бумажный дух | idle wingbeat, fly, windup, dive, recover, hurt, defeat | 7 × 4 = 28 | enemies/moth.png |
| Страж грозы | idle, move, windup, cleave, vulnerable recover, hurt, defeat | 7 × 4 = 28 | enemies/oni.png |

Всего **240 кадров**, девять страниц, четыре колонки на страницу, ячейка **384×256**. Максимальная страница **1536×2048**, прозрачный alpha, опорная точка **(192, 235)**. Первые восемь действий героя на основной странице, остальные пять — на combat. Именованные анимации настраиваются в `src/rendering/animation.ts`. Атласы проверяются на непустоту, прозрачность и уникальность кадров; метаданные/хэши — в `ART_FRAME_AUDIT.json`.

Для длинных действий дополнительно созданы отдельные исходные 4×4 листы: отталкивание, dash, катана, смерть героя и подготовка/удар/восстановление/поражение босса. Это исправляет недостатки первоначальной плотной сетки, где оружие пересекало номинальные границы ячейки.

Подготовка использует alpha-aware разделение силуэтов, общую шкалу на лист и единую опору. Нарезка не создаёт движений, не вращает статичную фигуру вместо кадров и не дорисовывает конечности. Сохранены исходные рисунки. Смысловая оценка поз дополнительно проводится в игре; автоматические хэши сами по себе не доказывают художественное качество.

## Окружение и эффекты

Три отдельные картины: небесные скалы и облачный монастырь; холодная лунная бамбуковая долина/водопады; обсидиановый лавовый каньон с разрушенными воротами. В runtime они оптимизированы до 720×1200 WebP. Переход между биомами плавный; туман/частицы движутся отдельными слоями.

Восемь нарисованных объектов окружения: мшистый уступ, треснувшая терракота, парящая механическая опора, запирающая балка, нефритовая стена, электрическая стена, вулканическая колонна и площадка арены. `assets:prepare` определяет точку контакта с нарисованной верхней поверхностью и сохраняет её в `src/data/terrain.ts`.

Программны только небольшие FX: искры, пыль, мягкий туман, электрическая линия, короткий направленный след катаны, полосы телеграфа и UI. Остаточные силуэты dash используют текущие реальные кадры персонажа. Босс показывает подготовку телом/оружием и индикатором заряда, а восстановление — отдельной анимацией и надписью окна.

## Итоговый набор промптов для воспроизведения

Каждый пункт — отдельный запрос встроенному imagegen. Для прозрачных ресурсов используется `transparent_background: true`. В качестве identity/costume reference применяются только оригинальные генерации предыдущих шагов, не изображения Mini Ninjas.

1. **model.png** — Original 2D side-view ninja scout, layered indigo cloth, asymmetric pale bamboo shoulder protection, leather wraps/tabi, vermilion split scarf, ivory brow band and bronze-guard katana. Crisp hand-painted ink cel style, warm upper-left rim light, cool teal shadows. Three separated full-body identity views: right side sheathed; front three-quarter holding katana; right-facing run. True transparent alpha; no text/logo/commercial character.
2. **ember.png** — Use original model identity. Eight columns/seven rows, 52 articulated drawings: four each idle/run/jump/rise/fall/landing/cling/slide/wall-jump/dash/forward katana/hurt/death. Right-facing, same anatomy/costume/scale, clear transparent gutters, feet/pivot consistency. No floor, grid, labels or scene.
3. **jade.png** — Edit original atlas, preserve poses/layout/alpha; replace costume with emerald robe, short ivory haori, pale green scarf, fitted hood and carved wooden bracers. Actual garment/silhouette changes, not a tint.
4. **moon.png** — Edit original atlas, preserve poses/layout/alpha; midnight tunic, split ivory coat-tails, ochre scarf, silver crescent clasp, silver forearm/shin plates. Same eyes/katana; actual accessory and cloth changes.
5. **sentinel.png** — Original masked temple guard, dark plum lacquer half-mask, pale slit eyes, straw shoulder cape, sash and short curved sword. Four columns/seven rows: idle/patrol/telegraph/forward slash/recover/hurt/death, four articulated frames per action; right-facing, transparent, no commercial design or scene.
6. **moth.png** — Original bronze lantern-moth, luminous teal eyes, ink-veined ivory paper wings, indigo tassel, talons. Four columns/seven rows: idle wingbeat/fly/windup/dive/recover/hurt/folded defeat. Transparent, coherent side view, no floating mask or primitive substitute.
7. **oni.png** — Original towering storm-temple warlord, bronze/black segmented armor, red trousers, asymmetric ivory antler helmet, indigo sash and heavy curved sword. Four columns/seven rows: breathing/heavy steps/overhead telegraph/forward cleave/exhausted recovery/hurt/kneeling collapse. Transparent full body and weapon, no existing boss design.
8. **sky.png** — Portrait above-cloud sanctuary at golden dawn: eroded jade pillars, floating distant shrines/bridges, wind-bent pines, ivory cloud sea, layered atmospheric ink/gouache perspective. Central 70% quiet for gameplay. No actors/UI/playable objects/text.
9. **night.png** — Portrait cold cobalt/cyan bamboo ravine, large pale moon, waterfall ribbons, lantern shrines, talismans and roof/bamboo silhouettes at edges. Different biome structures, central field quiet, no actors/UI/text.
10. **inferno.png** — Portrait obsidian volcanic canyon, molten rivers/waterfalls, broken red torii and chains, jagged silhouettes, smoky crimson sky and ash. Dark open central field; charcoal/burnt red/orange palette. No actors/UI/text.
11. **terrain.png** — Transparent original hand-painted 4×2 object sheet: stone ledge, cracked ledge, floating mechanical ledge, gate beam; jade wall, electrical metal wall, volcanic column, ornate boss arena. Flat readable collision faces, rich carved/painted surfaces, no characters/grid/text.
12. **ember-actions.png** — Use original hero identity. Four columns/four rows with generous gutters and whole limbs/weapons: four wall-push/leftward wall-jump poses; four rightward air dash poses; four katana windup/down-right slash/full forward blade/follow-through; four stagger/kneel/fall/lying death poses. True transparent alpha, same costume and articulated anatomy.
13. **jade-actions.png** — Edit preceding 4×4 target with jade costume reference only. Preserve all16 poses/pivots/weapon positions/alpha; hooded emerald/ivory garments, green scarf, wooden bracers.
14. **moon-actions.png** — Edit preceding 4×4 target with moon costume reference only. Preserve all16 poses/pivots/weapon positions/alpha; split ivory coat, ochre scarf, silver plates/clasp.
15. **oni-actions.png** — Use original oni identity; four columns/four rows with full weapon padding. Four overhead windups, four forward cleaves, four fatigued vulnerable recovery poses, four stagger/kneel/hip collapse/lying defeat poses. Same bronze/black armor, antlers, sash and sword, true alpha, no scene/grid/text.

## Проверка и ограничения

Исходные листы и подготовленные кадры просмотрены визуально; модели подключены к соответствующим состояниям, а не демонстрируются целым листом. Автоматическая проверка подтверждает формат/alpha/непустоту/уникальность. Desktop и портретный просмотр и конкретные результаты перечислены в QA.md.

Реальное устройство и субъективная плавность на слабом GPU требуют отдельной проверки. Небольшие рисованные различия формы ткани между кадрами допустимы для выбранной покадровой стилистики; программной интерполяции поз нет. Чужие референсы и исходные генерации не публикуются в релизном ZIP.
