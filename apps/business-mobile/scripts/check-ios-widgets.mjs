// Ejecuta los widgets de iOS ya serializados (bundle exportado con `expo export -p ios --no-bytecode`)
// con los mismos globales que el runtime de expo-widgets: detecta referencias a variables externas.
// Uso: node scripts/check-ios-widgets.mjs <bundle-ios.js>
import fs from 'node:fs';


const C = await import(new URL('../../../packages/contracts/dist/index.js', import.meta.url).href);
const bundle = fs.readFileSync(process.argv[2], 'utf8');
const fns = [];
let i = 0;
while ((i = bundle.indexOf('"function(p,env){', i)) !== -1) {
  let j = i + 1;
  while (!(bundle[j] === '"' && bundle[j - 1] !== '\\')) j++;
  fns.push(new Function("return " + bundle.slice(i, j + 1))());
  i = j;
}
console.log('widgets serializados:', fns.length);
// Globales del runtime de expo-widgets: componentes y modificadores devuelven nodos simples.
const ui = fs.readFileSync(new URL('../../../node_modules/@expo/ui/build/swift-ui/index.d.ts', import.meta.url), 'utf8');
const mods = fs.readFileSync(new URL('../../../node_modules/@expo/ui/build/swift-ui/modifiers/index.d.ts', import.meta.url), 'utf8');
const names = new Set(['HStack','VStack','Text','Image','Spacer','Link','ZStack']);
const dir = new URL('../../../node_modules/@expo/ui/build/swift-ui/modifiers', import.meta.url).pathname;
for (const f of fs.readdirSync(dir, { recursive: true })) {
  if (!String(f).endsWith('.d.ts')) continue;
  const src = fs.readFileSync(`${dir}/${f}`, 'utf8');
  for (const m of src.matchAll(/export declare (?:const|function) (\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export \{([^}]*)\}/g)) m[1].split(',').map((x) => x.trim().split(' as ').pop()).filter((x) => /^\w+$/.test(x)).forEach((x) => names.add(x));
}
const g = {};
for (const n of names) { g[n] = (...args) => ({ mod: n, args }); Object.defineProperty(g[n], 'name', { value: n }); }
g.shapes = { capsule: () => 'capsule', roundedRectangle: (o) => ['rr', o] };
const nodes = [];
g._jsx = g._jsxs = (type, props) => { const node = { type: typeof type === 'function' ? type.name : type, props }; nodes.push(node); return node; };
const keys = Object.keys(g);
const vals = Object.values(g);
const snap = (privacy) => C.buildWidgetSnapshot({
  now: new Date('2026-10-14T09:40:00.000-07:00'),
  business: { id: 'b', name: 'Estudio Órbita', timezone: 'America/Mazatlan' },
  privacy, today: '2026-10-14',
  week: { appointments: [
    { id: 'a1', status: 'CONFIRMED', startsAt: '2026-10-14T10:00:00.000-07:00', endsAt: '2026-10-14T10:45:00.000-07:00', expiresAt: null, customer: { name: 'Mariana López' }, professional: { name: 'Ana', colorKey: 'lavender' }, service: { name: 'Corte y peinado' } },
  ], days: [{ date: '2026-10-14', confirmed: 1, pending: 0, completed: 0, cancelled: 0, noShow: 0 }] },
  schedules: null,
});
let ok = 0;
for (const privacy of ['INITIALS', 'HIDDEN']) {
  for (const [k, entry] of C.buildWidgetTimeline(snap(privacy), new Date('2026-10-14T09:40:00.000-07:00')).entries()) {
    for (const [idx, src] of fns.entries()) {
      const fn = new Function(...keys, `return (${src});`)(...vals);
      for (const colorScheme of ['light', 'dark']) {
        const tree = fn({ ...entry.props, oriImage: 'file:///tmp/ori.png' }, { date: entry.date, colorScheme, widgetFamily: ['systemSmall', 'systemMedium', 'systemLarge'][idx] });
        if (!tree || !tree.type) throw new Error('El widget no devolvió un árbol');
        ok++;
      }
    }
  }
}
const texts = nodes.filter((n) => n.type === 'Text').map((n) => n.props.children).filter((t) => typeof t === 'string');
console.log('renders OK:', ok, '· textos de ejemplo:', [...new Set(texts)].slice(0, 14).join(' | '));
if (fns.length !== 3 || ok === 0) { console.error('Se esperaban 3 widgets serializados'); process.exit(1); }
