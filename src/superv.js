// El modo supervivencia (en beta): Eira, la Trece, sola en Oceanside. Sin facción y con su gente desaparecida, busca
// comida, agua, curas y lo que le sirva para seguir. El mundo son zonas conectadas (como un mundo abierto que se
// carga por trayectos): el escondite de la Trece en el centro y, alrededor, el asentamiento de Oceanside, la casa del
// pescador y el faro. Entre dos zonas hay un paso (una galería con una reja en medio que se sube girando una manivela,
// manteniendo Recoger; la reja cae otra vez al pasar): mientras se cruza a oscuras, se carga la zona de al lado.
//
// Los descansos (el saco del escondite y un fuego en cada zona) son lo único fijo: ahí se guarda, se cura (comiendo
// algo), se elige la hora a la que salir, se cocina, se viaja a otro descanso ya encendido (cuesta comida y agua, a
// veces se pierde una venda por el camino y, según la hora, te pueden salir al paso: dos oleadas en el camino de la
// costa), se mejoran las armas con piezas (en la mesa del escondite) y se aprenden habilidades (con suplementos,
// cuando se tiene el manual de esa rama). Al descansar, los infectados de la zona vuelven a estar. Al morir, se
// despierta en el último descanso con lo que se llevaba entonces.
//
// La prueba (modo libre, «Modo supervivencia · prueba»): elegir con qué se empieza y forzar las probabilidades. No
// se guarda. Lo que necesita del juego lo da main.js (init(host)).
(function (G) {
  'use strict';
  const U = G.Util, TAU = Math.PI * 2;
  const KEY = 'ceniza.supervivencia';
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const para = (t) => esc(t).split('\n').map((l) => '<p>' + l + '</p>').join('');
  const snd = (id, o) => { if (G.Audio) G.Audio.play(id, o); };
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const rnd = (a, b) => a + Math.random() * (b - a);
  let host = null;
  const P = () => host && host.player;
  // los nombres en medio de una frase: «la casa del pescador», «al escondite de la Trece»
  const lc = (n) => String(n).replace(/^(El|La|Los|Las) /, (m) => m.toLowerCase());
  const toName = (n) => { const l = lc(n); return l.indexOf('el ') === 0 ? 'al ' + l.slice(3) : 'a ' + l; };

  // ================= Los datos =================
  // La hora a la que se sale del descanso: la luz, cuántos infectados hay, lo que se encuentra y lo que arriesgas
  // en un viaje (amb: probabilidad de que te salgan al paso · warn: de verlo venir y poder rodear)
  const HOURS = [
    { id: 'alba', name: 'Al alba', h: 6.5, amb: 0.17, risk: 'medio', zk: 1.2, stalk: 1, blind: 0, loot: 1.0, sup: 1.2, warn: 0.8, day: false,
      note: 'Poca luz y bruma. Los infectados todavía no se han dispersado.' },
    { id: 'manana', name: 'Por la mañana', h: 9.5, amb: 0.08, risk: 'bajo', zk: 1.0, stalk: 0, blind: 0, loot: 1.35, sup: 1.0, warn: 1, day: true,
      note: 'Se ve lejos: si te salen al paso, los ves venir. Se encuentra más comida y agua.' },
    { id: 'mediodia', name: 'A mediodía', h: 13.0, amb: 0.08, risk: 'bajo', zk: 1.0, stalk: 0, blind: 0, loot: 1.35, sup: 1.0, warn: 1, day: true,
      note: 'La hora más tranquila. Se encuentra más comida y agua.' },
    { id: 'tarde', name: 'Por la tarde', h: 16.8, amb: 0.17, risk: 'medio', zk: 1.1, stalk: 0, blind: 0, loot: 1.1, sup: 1.0, warn: 1, day: true,
      note: 'Todavía hay luz, pero empiezan a moverse.' },
    { id: 'atardecer', name: 'Al atardecer', h: 19.3, amb: 0.25, risk: 'alto', zk: 1.3, stalk: 1, blind: 0, loot: 1.0, sup: 1.3, warn: 0.75, day: false,
      note: 'La luz se va. Más infectados, y algún observador.' },
    { id: 'noche', name: 'De noche', h: 23.2, amb: 0.33, risk: 'alto', zk: 1.6, stalk: 2, blind: 1, loot: 0.8, sup: 1.8, warn: 0.5, day: false,
      note: 'Muchos más, y casi no se ve. Pero de noche aparecen más suplementos (y los que están quietos no te ven tan lejos).' }
  ];
  const hourDef = (id) => HOURS.find((h) => h.id === id) || HOURS[1];
  // Las zonas: el mapa, el descanso (y dónde apareces al llegar a él), las salidas (cada una a un paso) y dónde
  // apareces al llegar desde cada zona vecina; cuántos infectados hay (de día) y cuántas cosas se encuentran
  const ZONES = {
    escondite: { map: 'sv_escondite', name: 'El escondite de la Trece', hub: true,
      rest: { x: 21.0, z: 39.6, reach: 1.7, label: 'Dormir en el saco', bed: true }, spawn: { x: 22.6, z: 38.4, face: Math.PI },
      bench: { x: 29.5, z: 37.5, fx: 28.6, fz: 37.5, label: 'La mesa de trabajo (mejorar armas)' },
      exits: [
        { to: 'oceanside', paso: 'via', x: 14.6, z: 7.6, label: 'Ir por la vía · Asentamiento de Oceanside', mark: [16.6, 7.2] },
        { to: 'pescador', paso: 'playa', x: 48.2, z: 43.0, label: 'Ir por la playa · La casa del pescador', mark: [47.6, 41.2] }
      ],
      arrive: { oceanside: { x: 14.5, z: 9.8, face: 0 }, pescador: { x: 46.6, z: 42.8, face: -Math.PI / 2 } },
      zombies: 2, loot: 4, keepOut: [[12, 31, 32, 44]],
      finds: [{ id: 'e_empu', kind: 'sv_p_empu', x: 23.4, z: 34.4 }, { id: 'e_sup', kind: 'sv_sup', n: 10, x: 15.6, z: 39.4 }] },
    oceanside: { map: 'oceanside', name: 'Asentamiento de Oceanside',
      rest: { x: 10.4, z: 28.6, reach: 2.4, label: 'Encender el fuego y descansar', fire: true }, spawn: { x: 11.8, z: 27.0, face: Math.PI / 2 },
      exits: [
        { to: 'escondite', paso: 'via', x: 7.0, z: 12.6, label: 'Pasar por detrás del camión · El escondite', mark: [7.4, 15.9] },
        { to: 'faro', paso: 'cabo', x: 75.0, z: 12.5, label: 'Salir por el portón del este · Faro de Oceanside', mark: [73.4, 16.0] }
      ],
      arrive: { escondite: { x: 9.2, z: 12.6, face: Math.PI / 2 }, faro: { x: 72.4, z: 12.6, face: -Math.PI / 2 } },
      zombies: 9, loot: 10, crudo: 0.6,
      finds: [{ id: 'o_rifle', kind: 'rifle', n: 1, x: 20.0, z: 23.0 }, { id: 'o_tiro', kind: 'sv_m_tiro', x: 42.0, z: 23.0 },
        { id: 'o_muelle', kind: 'sv_p_muelle', x: 41.5, z: 51.0 }, { id: 'o_carg', kind: 'sv_p_carg', x: 53.5, z: 50.0 }, { id: 'o_sup', kind: 'sv_sup', n: 12, x: 10.0, z: 51.0 }] },
    faro: { map: 'sv_faro', name: 'Faro de Oceanside',
      rest: { x: 27.0, z: 29.6, reach: 2.4, label: 'Encender el fuego y descansar', fire: true }, spawn: { x: 27.0, z: 31.8, face: Math.PI },
      exits: [{ to: 'oceanside', paso: 'cabo', x: 16.5, z: 6.4, label: 'Salir por la verja · Asentamiento de Oceanside', mark: [18.6, 6.0] }],
      arrive: { oceanside: { x: 16.5, z: 8.6, face: 0 } },
      zombies: 7, loot: 8, crudo: 0.5,
      finds: [{ id: 'f_esc', kind: 'escopeta', n: 2, x: 56.0, z: 11.4 }, { id: 'f_mira', kind: 'sv_p_mira', x: 23.0, z: 47.0 },
        { id: 'f_aux', kind: 'sv_m_aux', x: 25.0, z: 13.0 }, { id: 'f_sup', kind: 'sv_sup', n: 12, x: 38.0, z: 37.5 }, { id: 'f_cerr', kind: 'sv_p_cerrojo', x: 10.5, z: 39.0 }] },
    pescador: { map: 'sv_pescador', name: 'La casa del pescador',
      rest: { x: 24.6, z: 36.4, reach: 2.4, label: 'Encender el fuego y descansar', fire: true }, spawn: { x: 26.0, z: 35.0, face: -Math.PI / 2 },
      exits: [{ to: 'escondite', paso: 'playa', x: 12.6, z: 7.4, label: 'Volver por el sendero · El escondite', mark: [14.6, 7.0] }],
      arrive: { escondite: { x: 12.5, z: 9.8, face: 0 } },
      zombies: 5, loot: 7, crudo: 2.4,
      finds: [{ id: 'p_sigilo', kind: 'sv_m_sigilo', x: 21.0, z: 23.0 }, { id: 'p_cuerda', kind: 'sv_p_cuerda', x: 35.0, z: 27.0 }, { id: 'p_culata', kind: 'sv_p_culata', x: 40.4, z: 36.0 }] }
  };
  // Los pasos entre dos zonas (la galería: a = la boca del sur, b = la del norte)
  const PASOS = {
    via: { name: 'La galería de la vía', kind: 'via', a: 'escondite', b: 'oceanside' },
    playa: { name: 'El aliviadero de la playa', kind: 'playa', a: 'escondite', b: 'pescador' },
    cabo: { name: 'El túnel del cabo', kind: 'cabo', a: 'oceanside', b: 'faro' }
  };
  const GATE_Z = 16, CRANK_T = 2.6;
  const CRANKS = [{ side: 'a', x: 8.75, z: 14.5, mx: 8.08, ry: 0 }, { side: 'b', x: 11.25, z: 17.5, mx: 11.92, ry: Math.PI }];
  // Lo que se lleva aparte (G.Surv): comida, agua, comida cruda, agua sin hervir y suplementos
  const RES = {
    sv_comida: { k: 'comida', name: 'comida', cap: 8 },
    sv_agua: { k: 'agua', name: 'agua', cap: 8 },
    sv_crudo: { k: 'crudo', name: 'pescado crudo', cap: 6 },
    sv_sucia: { k: 'sucia', name: 'agua sin hervir', cap: 6 },
    sv_sup: { k: 'sup', name: 'suplementos', cap: 999 }
  };
  const RES_NAME = { comida: 'Comida', agua: 'Agua', crudo: 'Pescado crudo', sucia: 'Agua sin hervir' };
  // Las piezas de las armas: cada una, para un arma y una de sus mejoras (las del banco del refugio de Retorno)
  const PARTS = {
    empu: { name: 'una empuñadura de goma', short: 'Empuñadura de goma', w: 'pistola', up: 'estabilidad' },
    muelle: { name: 'un muelle reforzado', short: 'Muelle reforzado', w: 'pistola', up: 'cadencia' },
    carg: { name: 'un cargador ampliado', short: 'Cargador ampliado', w: 'pistola', up: 'capacidad' },
    mira: { name: 'una mira telescópica', short: 'Mira telescópica', w: 'rifle', up: 'mira' },
    cerrojo: { name: 'un cerrojo pulido', short: 'Cerrojo pulido', w: 'rifle', up: 'cadencia' },
    culata: { name: 'una culata acolchada', short: 'Culata acolchada', w: 'escopeta', up: 'estabilidad' },
    cuerda: { name: 'una cuerda de arco nueva', short: 'Cuerda de arco nueva', w: 'arco', up: 'alcance' }
  };
  // Las ramas de habilidades: cada una se abre con su manual (se encuentra) y cada nivel cuesta suplementos
  const BRANCHES = [
    { id: 'sigilo', name: 'Sigilo', manual: 'sigilo', manualName: 'La libreta de rastreo', desc: 'Lo que la Trece aprendió cazando Escorpiones.',
      levels: [{ cost: 15, key: 'listen', val: 1, txt: 'Escuchar: agachada, oyes a los infectados a través de las paredes' },
        { cost: 30, key: 'listenR', val: 8, txt: 'Oído fino: escuchar llega 8 m más lejos' },
        { cost: 45, key: 'stealth', val: 0.12, txt: 'Sin rastro: cuesta más verte agachada' }] },
    { id: 'punteria', name: 'Puntería', manual: 'tiro', manualName: 'El manual de tiro', desc: 'Un manual del ejército, subrayado a lápiz.',
      levels: [{ cost: 20, key: 'aim', val: 0.2, txt: 'Apuntas un 20 % más rápido' },
        { cost: 35, key: 'recoil', val: 0.15, txt: 'Las armas retroceden un 15 % menos' },
        { cost: 50, key: 'reload', val: 0.12, txt: 'Recargas un 12 % más rápido' }] },
    { id: 'aguante', name: 'Aguante', manual: 'aux', manualName: 'El manual de primeros auxilios', desc: 'De la estación de señales del faro.',
      levels: [{ cost: 20, key: 'bandage', val: 10, txt: 'Cada venda cura 10 de vida más' },
        { cost: 35, key: 'heal', val: 0.2, txt: 'Te vendas un 20 % más rápido' },
        { cost: 50, key: 'vit', val: 0.08, txt: 'Aguantas un 8 % más cada golpe' }] }
  ];
  const MANUAL_NAME = { sigilo: 'la libreta de rastreo', tiro: 'el manual de tiro', aux: 'el manual de primeros auxilios' };
  // Lo que se cocina en un descanso
  const RECIPES = [
    { id: 'guiso', name: 'Pescado asado', need: { crudo: 1 }, give: { comida: 2 }, txt: 'Un pescado al fuego: dos raciones de comida.' },
    { id: 'hervir', name: 'Hervir agua', need: { sucia: 1 }, give: { agua: 1 }, txt: 'El agua de lluvia o del pozo, hervida: se puede beber.' },
    { id: 'venda', name: 'Venda hervida', need: { trapo: 1, agua: 1 }, give: { venda: 1 }, txt: 'Un trapo hervido en agua limpia: una venda.' }
  ];
  // Las notas de la Trece (en el escondite): una más cada vez que vuelve herida a dormir
  const EIRA_NOTES = [
    'Me abrí el costado otra vez saltando la valla del asentamiento. Tres puntos, mal dados.\nGrimes diría que soy una burra. Grimes no está.',
    'Las vendas se acaban antes que los infectados. Hierve los trapos, Eira. Hiérvelos aunque estés cansada.\nHoy casi no subo la loma.',
    'Cuento las balas antes de dormir. Las cuento dos veces. Es lo único que me deja dormir.\nEl faro sigue girando. Alguien le da cuerda.',
    'Ya no sé cuántos días van. La comida dice que muchos.\nSi alguien lee esto: no me esperes. Sigue andando.'
  ];

  // los objetos sueltos de este modo (G.Pickups los dibuja y los recoge; player.takeItem los manda aquí)
  function registerKinds() {
    const K = G.Pickups && G.Pickups.KINDS;
    if (!K || K.sv_comida) return;
    K.sv_comida = { name: 'comida', n: [1, 1], w: 0, lift: 0.01 };
    K.sv_agua = { name: 'agua', n: [1, 1], w: 0, lift: 0.01 };
    K.sv_crudo = { name: 'pescado crudo', n: [1, 1], w: 0, lift: 0.01 };
    K.sv_sucia = { name: 'agua sin hervir', n: [1, 1], w: 0, lift: 0.01 };
    K.sv_sup = { name: 'suplementos', n: [4, 9], w: 0, lift: 0.01 };
    for (const id in PARTS) K['sv_p_' + id] = { name: PARTS[id].name, n: [1, 1], w: 0, lift: 0.01 };
    for (const id in MANUAL_NAME) K['sv_m_' + id] = { name: MANUAL_NAME[id], n: [1, 1], w: 0, lift: 0.01 };
    // (las armas de fuego que se encuentran: se cogen como un arma)
    for (const id of ['rifle', 'escopeta', 'revolver', 'arco']) if (!K[id]) { const w = G.Weapons.get(id); if (w) K[id] = { name: w.name, n: [1, 1], w: 0, lift: 0.045, weapon: true }; }
  }

  // ================= El estado =================
  let S = null;                 // la partida (se guarda)
  let snapRest = null;          // copia de la partida en el último descanso (al morir se vuelve a ella)
  let R = null;                 // lo de ahora mismo (no se guarda): la escena de la zona, los props, la reja...
  let active = false, test = null, prevChar = null;
  let hudEl = null, barEl = null, hudT = 0;

  function fresh() {
    return { v: 1, zone: 'escondite', rest: 'escondite', hour: 'manana', visited: { escondite: true }, res: { comida: 2, agua: 2, crudo: 0, sucia: 0 }, sup: 0,
      parts: {}, manuals: {}, skills: {}, up: {}, inv: null, took: {}, Z: {}, rests: 0, wounds: 0, notes: 0, stats: { travels: 0, ambushes: 0, rests: 0 }, intro: false };
  }
  function save() {
    if (!S || test) return;
    try { localStorage.setItem(KEY, JSON.stringify({ live: S, snap: snapRest })); } catch (e) { /* nada */ }
  }
  function readSave() {
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.live && d.live.v === 1 ? d : null; } catch (e) { return null; }
  }
  function zstate(id) { if (!S.Z[id]) S.Z[id] = { left: null, lootAt: -1, alive: null, zAt: -1 }; return S.Z[id]; }

  // ---------- el equipo de la protagonista ----------
  function kitNew(p) {
    p.hands = [null, null, null, null, null]; p.stored = [];
    for (const k in p.items) p.items[k] = 0;
    for (const k in p.ammo) p.ammo[k] = 0;
    p.pickUp('pistola', 8, 1);
    p.ammo['9mm'] = 6;
    p.pickUp('arco', 1, 1);
    p.ammo.flecha = 3;
    p.items.venda = 1; p.items.trapo = 1; p.items.pandora = 1;
    p.health = 100;
    p.equip(-1);
  }
  function restorePlayer() {
    const p = P();
    if (S.inv) G.Run.unsnap(p, S.inv); else kitNew(p);
    G.Weapons.applyUpgrades(S.up);
    p.infinite = false; p.stockMax = {};
  }
  function keepPlayer() { const p = P(); if (p && !p.dead) S.inv = G.Run.snap(p); }
  function hasWeapon(id) { const p = P(); return p.hands.concat(p.stored).some((h) => h && h.id === id); }

  // ---------- la hora ----------
  function applyHour() {
    if (!G.Sky) return;
    G.Sky.set(hourDef(S.hour).h, null);
    G.Sky.fixHour(true);
  }

  // ================= La escena de una zona (lo que se dibuja aquí) =================
  let mats = null;
  function M() {
    if (mats) return mats;
    const fl = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    fl.toneMapped = false;
    mats = { body: new THREE.MeshLambertMaterial({ vertexColors: true }), flame: fl };
    return mats;
  }
  function mesh(draw, x, y, z, ry) {
    const m = new G.Mesher(); draw(m);
    const o = new THREE.Mesh(m.build(), M().body);
    o.position.set(x, y, z); o.rotation.y = ry || 0; o.castShadow = true; o.receiveShadow = true;
    R.group.add(o);
    return o;
  }
  const gy = (x, z) => G.World.groundY(x, z, 0);
  function prop(p) { const q = Object.assign({ kind: 'surv', reach: 1.8 }, p); if (p.lab) Object.defineProperty(q, 'label', { get: p.lab, enumerable: true }); G.Props.add(q); R.props.push(q); return q; }
  function newScene() {
    clearScene();
    R = { group: new THREE.Group(), props: [], anims: [], blocks: [], t: 0, fires: [], amb: null, gate: null, crank: null, finds: [], findT: 0, zl: [], near: [] };
    host.scene.add(R.group);
  }
  function clearScene() {
    if (!R) return;
    if (R.group.parent) R.group.parent.remove(R.group);
    R.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const q of R.props) { const i = G.Props.list.indexOf(q); if (i >= 0) G.Props.list.splice(i, 1); }
    R = null;
  }
  // un estorbo invisible (como en las paradas): un mueble sin dibujo
  function blocker(x0, z0, x1, z1, h) {
    const W = G.World, c = W.chunkAt(Math.floor((x0 + x1) / 2) >> 5, Math.floor((z0 + z1) / 2) >> 5);
    const f = { type: 'bloques', lv: 0, x0, x1, z0, z1, y: gy((x0 + x1) / 2, (z0 + z1) / 2), h: h || 1, fx: 0, fz: 1, solid: true, cont: null, calmBlock: true };
    c.furn.push(f);
    if (G.Furniture.indexChunk) G.Furniture.indexChunk(c, 32);
    R.blocks.push({ c, f });
    return f;
  }
  function setSolid(b, on) {
    const B = R.blocks.find((q) => q.f === b);
    if (!B || b.solid === on) return;
    b.solid = on; b.gone = !on;
    if (G.Furniture.indexChunk) G.Furniture.indexChunk(B.c, 32);
  }
  // el sitio libre más cercano (por si el punto cae encima de un mueble)
  function freeNear(x, z, r) {
    const W = G.World, inside = W.isIndoor(Math.floor(x), Math.floor(z), 0);
    for (let d = 0; d <= 3; d += 0.3) {
      for (let k = 0; k < (d ? 12 : 1); k++) {
        const a = k / 12 * TAU, qx = x + Math.sin(a) * d, qz = z + Math.cos(a) * d;
        if (W.circleBlocked(qx, qz, r || 0.32, 0)) continue;
        if (d > 0.6 && W.isIndoor(Math.floor(qx), Math.floor(qz), 0) !== inside) continue;
        return { x: qx, z: qz };
      }
    }
    return { x, z };
  }

  // ---------- un fuego (las llamas; sin luz propia, como en las paradas: no recompila nada) ----------
  function fire(x, z, lit) {
    const y = gy(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z); R.group.add(g);
    // las piedras y los leños
    const m = new G.Mesher();
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; m.sphere(Math.sin(a) * 0.5, 0.06, Math.cos(a) * 0.5, 0.13, 0.09, 0.11, U.shade(0x6a665e, 0.85 + (k % 3) * 0.08), 0); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI + 0.3; m.cyl(0, 0.08, 0, 0.045, 0.05, 0.7, 0x3a2a1c, 6, undefined, Math.PI / 2 - 0.25, a, 0); }
    const base = new THREE.Mesh(m.build(), M().body); base.receiveShadow = true; g.add(base);
    const fl = new THREE.Group(); g.add(fl);
    const flames = [];
    for (let k = 0; k < 5; k++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 - k * 0.015, 0.6 - k * 0.05, 6), M().flame);
      const a = k / 5 * TAU;
      f.position.set(Math.sin(a) * (k ? 0.13 : 0), 0.3, Math.cos(a) * (k ? 0.13 : 0)); fl.add(f);
      flames.push({ m: f, ph: k * 1.7, b: 0.6 - k * 0.05 });
    }
    const F = { x, z, lit: !!lit, fl, flames, crk: 1 };
    fl.visible = F.lit;
    R.fires.push(F);
    return F;
  }
  function updateFires(dt) {
    for (const F of R.fires) {
      if (!F.lit) continue;
      for (const f of F.flames) { const s = 0.75 + 0.3 * Math.sin(R.t * 7 + f.ph) + 0.15 * Math.sin(R.t * 13 + f.ph * 2); f.m.scale.set(1, s, 1); f.m.position.y = f.b * s / 2 + 0.06; }
      if ((F.crk -= dt) <= 0) { F.crk = 1.8 + Math.random() * 2.2; const p = P(); if (p && Math.hypot(p.pos.x - F.x, p.pos.z - F.z) < 9) snd('crackle', { x: F.x, z: F.z, vol: 0.35 }); }
    }
  }
  // la marca de la Trece en sus caminos: un trapo rojo atado a un palo (las salidas se ven así, sin carteles)
  function trailMark(x, z) {
    const y = gy(x, z);
    mesh((m) => { m.cyl(0, 0.65, 0, 0.04, 0.05, 1.3, 0x5a4a38, 6); m.box(0, 1.18, 0.0, 0.07, 0.06, 0.07, 0x7a2a22); }, x, y, z, 0);
    const cl = mesh((m) => { m.box(0, -0.16, 0.13, 0.02, 0.32, 0.22, 0xa8322a); }, x, y + 1.2, z, Math.random() * TAU);
    cl.castShadow = false;
    R.anims.push((dt) => { cl.rotation.y += Math.sin(R.t * 1.3 + x) * dt * 0.6; cl.rotation.z = Math.sin(R.t * 2.1 + z) * 0.12; });
  }

  // ================= Entrar en una zona =================
  // how: { rest: true } (en el descanso: al empezar, al viajar o al despertar) o { from: zona } (por el paso)
  function enterZone(id, how) {
    const Z = ZONES[id] || ZONES.escondite, p = P();
    leaveHere();
    newScene();
    host.map(Z.map);
    restorePlayer();
    applyHour();
    S.zone = id; S.where = 'zone'; S.paso = null;
    const at = how && how.rest ? Z.spawn : ((how && Z.arrive[how.from]) || Z.spawn);
    const sp = freeNear(at.x, at.z);
    host.place(sp.x, sp.z, at.face || 0);
    buildZone(id, Z);
    lootZone(id, Z);
    zombiesZone(id, Z, false);
    host.peace(false);
    save();
    hud(true);
  }
  // antes de irse (o de guardar): lo que quedó en el suelo, los que siguen vivos y el equipo
  function leaveHere() {
    if (!S || !R) return;
    keepPlayer();
    if (S.where === 'zone') {
      syncFinds();
      const zs = zstate(S.zone);
      zs.left = G.Pickups.list.filter((it) => !it.svFind && !it.armed && !it.flying).map((it) => ({ id: it.id, n: it.n, x: it.x, y: it.y, z: it.z, lv: it.lv || 0, cond: it.cond }));
      zs.alive = G.Population.list.filter((z) => z.alive && !z.human && z.svAmb).length;
    }
  }
  function buildZone(id, Z) {
    const W = G.World;
    // el descanso
    const Rr = Z.rest;
    if (Rr.fire) R.restFire = fire(Rr.x, Rr.z, !!S.visited[id]);
    prop({ x: Rr.x, z: Rr.z, reach: Rr.reach || 2.2, lab: () => (S.visited[id] || Rr.bed ? (Rr.bed ? Rr.label : 'Descansar junto al fuego') : Rr.label),
      use: () => { restStart(id); return null; } });
    // la mesa de trabajo (el escondite)
    if (Z.bench) prop({ x: Z.bench.x, z: Z.bench.z, fx: Z.bench.fx, fz: Z.bench.fz, reach: 1.9, label: Z.bench.label, use: () => { openRest(id, 'mejorar', true); return null; } });
    // las salidas: la marca de la Trece y, al lado, el camino (al paso)
    for (const X of Z.exits) {
      trailMark(X.mark[0], X.mark[1]);
      prop({ x: X.x, z: X.z, reach: 2.4, label: X.label, use: () => { goPaso(X.paso, id); return null; } });
    }
    // el escondite: si volvió herida a dormir, las vendas usadas junto al saco y una nota suya en la mesa
    if (Z.hub && S.wounds > 0) {
      for (const [x, z, r] of [[20.2, 38.4, 0.3], [19.8, 40.6, 0.2], [21.9, 41.2, 0.25]]) mesh((m) => { m.box(0, 0.012, 0, r, 0.02, r * 0.7, 0xd8cfc0); m.box(0.03, 0.025, 0.01, r * 0.5, 0.005, r * 0.35, 0x8a2a22); }, x, gy(x, z), z, x * 3);
      const nx = 27.0, nz = 40.6;
      mesh((m) => { m.box(0, 0.006, 0, 0.21, 0.012, 0.28, 0xe8e0cc); m.box(0.02, 0.014, -0.02, 0.16, 0.004, 0.003, 0x6a6458); }, nx, gy(nx, nz) + 0.82, nz, 0.4);
      const k = Math.min(EIRA_NOTES.length, S.wounds) - 1;
      prop({ x: nx, z: nz - 0.8, fx: nx, fz: nz, reach: 1.6, label: 'Leer la nota de la mesa', use: () => { noteUI('Una nota suya, a lápiz', EIRA_NOTES[k]); return null; } });
    }
    // los hallazgos de la zona que no se han cogido todavía
    for (const f of Z.finds || []) {
      if (S.took[f.id]) continue;
      const q = freeNear(f.x, f.z, 0.25);
      const it = G.Pickups.add(f.kind, f.n || 1, { x: q.x, y: W.groundY(q.x, q.z, 0), z: q.z, lv: 0 });
      it.svFind = f.id;
      if (G.Pickups.KINDS[f.kind] && G.Pickups.KINDS[f.kind].weapon) it.cond = f.n || 1;
      R.finds.push({ f, it });
    }
    // al entrar: dónde se está
    setTimeout(() => { if (active && R && S && S.zone === id && S.where === 'zone') host.toast(Z.name + (S.visited[id] ? '' : (Z.rest.fire ? ' · busca el fuego para descansar' : '')), 'good'); }, 700);
  }
  // los hallazgos: se cogen como cualquier otro objeto; si ya no están en el suelo, se cogieron
  function syncFinds() {
    if (!R) return;
    for (const F of R.finds) if (!S.took[F.f.id] && G.Pickups.list.indexOf(F.it) < 0) S.took[F.f.id] = true;
  }
  // lo que hay por el suelo: lo que se dejó al irse o, si se descansó desde entonces, lo nuevo
  function lootZone(id, Z) {
    const zs = zstate(id);
    if (zs.left && zs.lootAt >= S.rests) {
      for (const o of zs.left) { if (!G.Pickups.KINDS[o.id]) continue; const it = G.Pickups.add(o.id, o.n, o); if (o.cond != null) it.cond = o.cond; }
      return;
    }
    // (las armas que se soltaron al coger otra no desaparecen: siguen donde se dejaron)
    for (const o of zs.left || []) { const K = G.Pickups.KINDS[o.id]; if (!K || !K.weapon) continue; const it = G.Pickups.add(o.id, o.n, o); if (o.cond != null) it.cond = o.cond; }
    const H = hourDef(S.hour), n = Math.max(2, Math.round(Z.loot * H.loot));
    const w = { sv_comida: 3, sv_agua: 2.2, sv_sucia: 2.2, sv_crudo: Z.crudo || 0.4, sv_sup: 1.4 * H.sup, _ammo: 3.2, venda: 0.35, alcohol: 1.6, trapo: 1.4, clavos: 0.8, polvo: 0.45, botella: 0.8, ladrillo: 0.6 };
    G.Pickups.spawn(n, { weights: w });
    zs.lootAt = S.rests; zs.left = null;
  }
  // los infectados de la zona: los de siempre (según la hora) o, si no se descansó desde que te fuiste, los que quedaban
  function zombiesZone(id, Z, refresh) {
    const zs = zstate(id), H = hourDef(S.hour);
    let n = Math.round(Z.zombies * H.zk), st = Z.hub ? 0 : H.stalk, bl = Z.hub ? 0 : H.blind;
    if (Z.hub && !H.day) n += 1;
    if (!refresh && zs.zAt >= S.rests && zs.alive != null) { const tot = n + st + bl; const k = tot ? zs.alive / tot : 0; n = Math.round(n * k); st = Math.round(st * k); bl = Math.round(bl * k); }
    zs.zAt = S.rests;
    spawnAmbient(Z, n, st, bl);
  }
  function spawnAmbient(Z, n, st, bl) {
    const W = G.World, p = P(), m = G.Maps.get(Z.map), A = (m.play && m.play[0]) || [m.min + 2, m.min + 2, m.max - 2, m.max - 2];
    const away = [[p.pos.x, p.pos.z, 16], [Z.rest.x, Z.rest.z, 14]].concat(Z.exits.map((X) => [X.x, X.z, 9]));
    const kinds = [];
    for (let i = 0; i < n; i++) kinds.push('runner');
    for (let i = 0; i < st; i++) kinds.push('stalker');
    for (let i = 0; i < bl; i++) kinds.push('blind');
    let made = 0;
    for (const kind of kinds) {
      for (let t = 0; t < 60; t++) {
        const x = rnd(A[0] + 1, A[2] - 1), z = rnd(A[1] + 1, A[3] - 1);
        if (away.some((a) => Math.hypot(x - a[0], z - a[1]) < a[2])) continue;
        if ((Z.keepOut || []).some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3])) continue;
        if (W.circleBlocked(x, z, 0.4, 0)) continue;
        if (t < 40 && W.isIndoor(Math.floor(x), Math.floor(z), 0) && Math.random() < 0.7) continue;
        const zb = new G.Zombie(host.scene, x, z, null, Math.random() * TAU, { lv: 0, stalker: kind === 'stalker', blind: kind === 'blind' });
        zb.svAmb = true; zb.state = 'idle'; zb.timer = 1 + Math.random() * 6; zb.target = null; zb.notice = 0;
        G.Population.list.push(zb);
        made++;
        break;
      }
    }
    return made;
  }

  // ================= Los pasos (la galería) =================
  function goPaso(pid, from) {
    if (busy()) return;
    host.shift(() => enterPaso(pid, from), () => {
      host.toast(PASOS[pid].name + ' · la reja está bajada: mantén Recoger en la manivela para subirla', 'good');
    });
  }
  function enterPaso(pid, from) {
    const D = PASOS[pid];
    leaveHere();
    newScene();
    Surv.pasoKind = D.kind;
    host.map('sv_paso');
    restorePlayer();
    applyHour();
    S.where = 'paso'; S.paso = { id: pid, from };
    const south = from === D.a;
    host.place(10, south ? 3.2 : 28.8, south ? 0 : Math.PI);
    buildPaso(D);
    host.peace(false);
    save();
    hud(true);
  }
  function buildPaso(D) {
    // la reja: barrotes de hierro oxidado de pared a pared; sube y baja en su sitio
    const g = new THREE.Group(); g.position.set(10, 0, GATE_Z); R.group.add(g);
    const m = new G.Mesher();
    for (let x = -1.85; x <= 1.86; x += 0.26) m.cyl(x, 1.4, 0, 0.022, 0.022, 2.8, 0x4a3e34, 5);
    for (const y of [0.12, 1.3, 2.6]) m.box(0, y, 0, 3.86, 0.07, 0.05, 0x3e342c);
    for (let x = -1.85; x <= 1.86; x += 0.26) m.cone(x, -0.05, 0, 0.03, 0.1, 0x3a3028, 4);
    const gm = new THREE.Mesh(m.build(), M().body); gm.castShadow = true; g.add(gm);
    const blk = blocker(8.0, GATE_Z - 0.12, 12.0, GATE_Z + 0.12, 3.0);
    R.gate = { g, blk, k: 0, open: false, openT: 0, falling: false };
    // las dos manivelas: una rueda con su mango, en la pared, a cada lado de la reja
    for (const C of CRANKS) {
      const base = mesh((q) => { q.box(0, 1.1, 0, 0.06, 0.5, 0.36, 0x3a3634); q.cyl(0.07, 1.1, 0, 0.03, 0.03, 0.14, 0x55524e, 6, undefined, 0, 0, Math.PI / 2); }, C.mx, gy(C.mx, C.z), C.z, C.ry);
      const wheel = new THREE.Group(); wheel.position.set(0.16, 1.1, 0); base.add(wheel);
      const wm = new G.Mesher();
      for (let k = 0; k < 4; k++) wm.box(0, 0, 0, 0.03, 0.44, 0.03, 0x6a4a30, 0, undefined, k * Math.PI / 4);
      wm.cyl(0, 0, 0, 0.23, 0.23, 0.04, 0x5a3e28, 12, undefined, 0, 0, Math.PI / 2);
      wm.cyl(0.08, 0.17, 0, 0.022, 0.022, 0.16, 0x8a6a48, 6, undefined, 0, 0, Math.PI / 2);
      const wh = new THREE.Mesh(wm.build(), M().body); wheel.add(wh);
      C.wheel = wheel;
      prop({ x: C.x, z: C.z, fx: C.mx + (C.side === 'a' ? 0.12 : -0.12), fz: C.z, reach: 1.5, lab: () => (R.gate.open ? 'La reja está subida' : 'Girar la manivela (mantener)'),
        use: (p) => { if (R.gate.open) return 'La reja ya está subida: pasa antes de que caiga'; crankStart(p, C); return null; } });
    }
    // las dos bocas: por donde se llegó y por donde se sigue
    const A = ZONES[D.a], B = ZONES[D.b];
    prop({ x: 10, z: 1.9, reach: 1.9, label: 'Salir · ' + A.name, use: () => { goZone(D.a, D.b); return null; } });
    prop({ x: 10, z: 30.1, reach: 1.9, label: 'Salir · ' + B.name, use: () => { goZone(D.b, D.a); return null; } });
  }
  function goZone(to, from) {
    if (busy()) return;
    host.shift(() => enterZone(to, { from }), null);
  }
  // la manivela: mientras se mantenga Recoger, la reja sube; si se suelta, vuelve a bajar despacio
  function crankStart(p, C) {
    if (p.busy() || p.dead) return;
    R.crank = { C, tick: 0 };
    crankPose(p, C);
  }
  function crankPose(p, C) { p.action = { kind: 'search', t: 0, dur: 0.75, impact: 2, face: Math.atan2(C.mx - p.pos.x, C.z - p.pos.z), low: false, done: false, svCrank: true }; }
  function updateGate(dt, p) {
    const Gt = R.gate;
    if (!Gt) return;
    const cr = R.crank;
    if (cr) {
      const far = Math.hypot(p.pos.x - cr.C.x, p.pos.z - cr.C.z) > 1.7;
      if (!G.Input.lootHeld || far || p.dead || Gt.open) { R.crank = null; if (p.action && p.action.svCrank) p.action = null; }
      else {
        Gt.k = Math.min(1, Gt.k + dt / CRANK_T);
        cr.C.wheel.rotation.x += dt * 5.2;
        if (!p.action || p.action.done || !p.action.svCrank) crankPose(p, cr.C);
        if ((cr.tick -= dt) <= 0) { cr.tick = 0.32; snd('bClick', { x: cr.C.x, z: cr.C.z, vol: 0.5 }); }
        if (Gt.k >= 1) {
          Gt.open = true; Gt.openT = 0; R.crank = null; if (p.action && p.action.svCrank) p.action = null;
          setSolid(Gt.blk, false);
          snd('clang', { x: 10, z: GATE_Z, vol: 0.5 });
          host.toast('La reja queda arriba un momento: pasa', 'good');
        }
      }
    } else if (!Gt.open && Gt.k > 0) {
      // (soltaste la manivela: la reja baja por su peso)
      const k0 = Gt.k;
      Gt.k = Math.max(0, Gt.k - dt * (Gt.falling ? 2.6 : 0.7));
      if (k0 > 0 && Gt.k === 0) { Gt.falling = false; snd('clang', { x: 10, z: GATE_Z, vol: 0.7 }); if (G.Camera.shake && Math.abs(p.pos.z - GATE_Z) < 6) G.Camera.shake(0.08); }
    }
    if (Gt.open) {
      Gt.openT += dt;
      // al pasar (o al irse de su lado), la reja cae de golpe
      if (Gt.openT > 1.2 && Math.abs(p.pos.z - GATE_Z) > 2.8) { Gt.open = false; Gt.falling = true; setSolid(Gt.blk, true); snd('drag', { x: 10, z: GATE_Z, vol: 0.5 }); }
    }
    Gt.g.position.y = Gt.k * 2.45;
  }

  // ================= Los descansos =================
  let restFade = false;
  function restStart(id) {
    const p = P(), Z = ZONES[id];
    if (busy() || p.dead) return;
    if (G.Population.list.some((z) => z.alive && !z.human && Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z) < 12 && (z.state === 'chase' || z.state === 'stalk' || z.state === 'attack'))) { host.toast('No puedes descansar con infectados detrás de ti', 'warn'); return; }
    restFade = true;
    p.action = { kind: 'pack', t: 0, dur: 1e9, impact: 2, face: p.facing, done: false, svRest: true };
    host.fade(1, 0.9);
    setTimeout(() => {
      if (!active || !R) { restFade = false; return; }
      const first = !S.visited[id];
      S.visited[id] = true;
      if (R.restFire) R.restFire.lit = true, R.restFire.fl.visible = true;
      // curarse: comiendo algo, del todo; sin comida, solo un poco
      const lines = [];
      if (p.health < 95) {
        if (Z.rest.bed && p.health < 50) S.wounds++;
        if (S.res.comida > 0) { S.res.comida--; p.health = 100; p.heal = 0; lines.push('Comes algo y descansas: te recuperas del todo (−1 comida)'); }
        else { p.health = Math.min(100, p.health + 30); lines.push('Sin nada que comer, descansar te cura poco'); }
      }
      S.rest = id; S.stats.rests++;
      keepPlayer();
      snapRest = clone(S);
      save();
      setTimeout(() => {
        restFade = false;
        if (p.action && p.action.svRest) p.action = null;
        host.fade(0, 0.8);
        if (first) lines.unshift(Z.rest.bed ? 'Tu escondite. Aquí se guarda todo' : 'Fuego encendido: ya puedes volver aquí desde otro descanso');
        openRest(id, 'hora', false, lines);
      }, 500);
    }, 950);
  }
  // al levantarse: la hora elegida queda, los infectados vuelven a estar y lo del suelo se renueva
  function restEnd(id) {
    S.rests++;
    const Z = ZONES[id], zs = zstate(id);
    host.clearZombies();
    zs.alive = null;
    zombiesZone(id, Z, true);
    keepPlayer();
    snapRest = clone(S);
    save();
    hud(true);
  }

  // ---------- el panel del descanso ----------
  const TABS = [['hora', 'Hora'], ['viajar', 'Viajar'], ['cocinar', 'Cocinar'], ['mejorar', 'Mejorar'], ['habil', 'Habilidades']];
  function resLine() {
    const p = P();
    return '<div class="sv-res">' + [['comida', S.res.comida], ['agua', S.res.agua], ['crudo', S.res.crudo], ['sucia', S.res.sucia]].map(([k, v]) => '<span class="r-' + k + '"><i></i>' + RES_NAME[k] + ' <b>' + v + '</b></span>').join('') +
      '<span class="r-sup"><i></i>Suplementos <b>' + S.sup + '</b></span><span class="r-venda"><i></i>Vendas <b>' + (p.items.venda || 0) + '</b></span></div>';
  }
  function openRest(id, tab, benchOnly, lines) {
    const Z = ZONES[id], o = { kind: 'rest', tab: tab || 'hora', sel: 0, dest: null, msg: (lines || []).join(' · '), bench: benchOnly };
    const tabs = () => (benchOnly ? [['mejorar', 'Mejorar']] : TABS.filter((t) => t[0] !== 'mejorar' || Z.bench));
    o.render = () => {
      const T = tabs();
      if (!T.some((t) => t[0] === o.tab)) o.tab = T[0][0];
      let body = '';
      if (o.tab === 'hora') body = hourBody();
      else if (o.tab === 'viajar') body = travelBody(id, o);
      else if (o.tab === 'cocinar') body = cookBody();
      else if (o.tab === 'mejorar') body = benchBody();
      else body = skillBody();
      uiRoot.innerHTML = '<div class="sv-card sv-rest"><div class="sv-head"><small>' + (benchOnly ? 'LA MESA DE TRABAJO' : (Z.rest.bed ? 'TU ESCONDITE' : 'DESCANSO')) + (test ? ' · PRUEBA' : '') + '</small><h3>' + esc(Z.name) + '</h3>' + resLine() + '</div>' +
        (T.length > 1 ? '<div class="sv-tabs">' + T.map((t) => '<button type="button" data-f data-k="tab" data-d="' + t[0] + '" class="' + (t[0] === o.tab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' : '') +
        '<div class="sv-body">' + body + '</div>' +
        (o.msg ? '<p class="sv-msg">' + esc(o.msg) + '</p>' : '') +
        '<div class="sv-ft">' + (test && !benchOnly ? '<button type="button" data-f data-k="free">Volver al modo libre</button>' : '') + '<button type="button" data-f data-k="back">' + (benchOnly ? 'Dejar la mesa' : 'Levantarse') + hintKeys() + '</button></div></div>';
      focus(o);
    };
    o.key = (k, d) => {
      const T = tabs();
      if (k === 'left' || k === 'right') { const i = T.findIndex((t) => t[0] === o.tab); o.tab = T[(i + (k === 'left' ? T.length - 1 : 1)) % T.length][0]; o.sel = 0; o.dest = null; o.render(); snd('ui'); return; }
      if (nav(o, k)) return;
      if (k === 'tab') { o.tab = d; o.sel = 0; o.dest = null; o.msg = ''; o.render(); return; }
      if (k === 'back') { closeUI(); if (!benchOnly) restEnd(id); return; }
      if (k === 'free') { closeUI(); restEnd(id); backToFree(); return; }
      if (k === 'hour') { S.hour = d; applyHour(); o.msg = hourDef(d).name + ': al levantarte, saldrás a esa hora'; snd('uiOk'); }
      else if (k === 'dest') { o.dest = d; o.msg = ''; }
      else if (k === 'go') { const to = o.dest; if (to && S.visited[to] && to !== id) { closeUI(); travel(id, to); return; } }
      else if (k === 'cook') o.msg = cook(d);
      else if (k === 'part') o.msg = mount(d);
      else if (k === 'learn') o.msg = learn(d);
      o.render();
    };
    openUI(o);
  }
  const chip = (r) => '<em class="rk rk-' + r + '">riesgo ' + r + '</em>';
  function hourBody() {
    return '<p class="sv-lead">¿A qué hora sales? La luz, los infectados de fuera y lo que arriesgas en el camino dependen de ella.</p><ul class="sv-list">' + HOURS.map((H) =>
      '<li><button type="button" data-f data-k="hour" data-d="' + H.id + '" class="' + (S.hour === H.id ? 'on' : '') + '"><b>' + H.name + '</b>' + chip(H.risk) + '<small>' + esc(H.note) + '</small></button></li>').join('') + '</ul>';
  }
  function travelBody(id, o) {
    const L = Object.keys(ZONES).filter((z) => z !== id && S.visited[z]);
    if (!L.length) return '<p class="sv-lead">Todavía no has encendido ningún otro fuego. Ve a pie, por los pasos, y descansa en otro sitio: desde entonces podrás viajar hasta allí.</p>';
    const H = hourDef(S.hour);
    const d = o.dest && L.indexOf(o.dest) >= 0 ? o.dest : null;
    return '<p class="sv-lead">Viajar cuesta <b>1 comida y 1 agua</b> (sin ellas, llegas agotada). Por el camino, a veces se pierde una venda; y te pueden salir al paso: ' + chip(H.risk) + ' saliendo ' + H.name.toLowerCase() + '.</p>' +
      '<ul class="sv-list">' + L.map((z) => '<li><button type="button" data-f data-k="dest" data-d="' + z + '" class="' + (d === z ? 'on' : '') + '"><b>' + esc(ZONES[z].name) + '</b><small>' + (ZONES[z].hub ? 'Tu escondite' : 'Fuego encendido') + '</small></button></li>').join('') + '</ul>' +
      (d ? '<div class="sv-go"><button type="button" data-f data-k="go" class="main">Viajar ' + esc(toName(ZONES[d].name)) + '</button></div>' : '');
  }
  function haveN(k) { const p = P(); return k in S.res ? S.res[k] : (p.items[k] || 0); }
  const NEED_NAME = { crudo: 'pescado crudo', sucia: 'agua sin hervir', agua: 'agua', comida: 'comida', trapo: 'trapo', venda: 'venda' };
  function cookBody() {
    return '<p class="sv-lead">Al fuego (o en el hornillo del escondite): comida y medicina. La munición no se cocina.</p><ul class="sv-list">' + RECIPES.map((r) => {
      const ok = Object.keys(r.need).every((k) => haveN(k) >= r.need[k]);
      const need = Object.keys(r.need).map((k) => r.need[k] + ' ' + NEED_NAME[k]).join(' + '), give = Object.keys(r.give).map((k) => r.give[k] + ' ' + NEED_NAME[k]).join(', ');
      return '<li><button type="button" data-f data-k="cook" data-d="' + r.id + '" class="' + (ok ? '' : 'no') + '"><b>' + r.name + '</b><em>' + need + ' → ' + give + '</em><small>' + esc(r.txt) + '</small></button></li>';
    }).join('') + '</ul>';
  }
  function cook(id) {
    const r = RECIPES.find((q) => q.id === id), p = P();
    if (!r) return '';
    const miss = Object.keys(r.need).filter((k) => haveN(k) < r.need[k]);
    if (miss.length) return 'Te falta: ' + miss.map((k) => NEED_NAME[k]).join(', ');
    for (const k of Object.keys(r.give)) {
      if (k in S.res && S.res[k] + r.give[k] > RES['sv_' + k].cap) return 'No te cabe más ' + NEED_NAME[k];
      if (k === 'venda' && p.itemRoom('venda') <= 0) return 'No te caben más vendas';
    }
    for (const k of Object.keys(r.need)) { if (k in S.res) S.res[k] -= r.need[k]; else p.items[k] -= r.need[k]; }
    for (const k of Object.keys(r.give)) { if (k in S.res) S.res[k] += r.give[k]; else p.items[k] = (p.items[k] || 0) + r.give[k]; }
    snd('crackle', { vol: 0.4 });
    keepPlayer(); save();
    return r.name + ': hecho';
  }
  function benchBody() {
    const ids = Object.keys(PARTS).filter((id) => S.parts[id]);
    if (!ids.length) return '<p class="sv-lead">Aquí se montan las piezas que encuentres en las armas que llevas: una mira para el rifle, un muelle para la pistola... Todavía no tienes ninguna.</p>';
    return '<p class="sv-lead">Cada pieza mejora un arma para siempre. Hace falta llevar el arma encima.</p><ul class="sv-list">' + ids.map((id) => {
      const D = PARTS[id], used = S.parts[id] === 2, w = G.Weapons.get(D.w), ups = (G.Weapons.UPGRADES || {})[D.w] || [], u = ups.find((q) => q.id === D.up);
      const has = hasWeapon(D.w);
      return '<li><button type="button" data-f data-k="part" data-d="' + id + '" class="' + (used ? 'on' : (has ? '' : 'no')) + '"><b>' + D.short + '</b><em>' + (w ? w.name : D.w) + (u ? ' · ' + u.name : '') + '</em><small>' +
        (used ? 'Montada' : (has ? (u && u.desc ? esc(u.desc) : 'Montar') : 'No llevas el arma')) + '</small></button></li>';
    }).join('') + '</ul>';
  }
  function mount(id) {
    const D = PARTS[id];
    if (!D || !S.parts[id]) return '';
    if (S.parts[id] === 2) return 'Ya está montada';
    if (!hasWeapon(D.w)) return 'Necesitas llevar encima: ' + (G.Weapons.get(D.w) || {}).name;
    S.up[D.w] = S.up[D.w] || {};
    S.up[D.w][D.up] = true;
    S.parts[id] = 2;
    G.Weapons.applyUpgrades(S.up);
    snd('magIn', { vol: 0.6 });
    keepPlayer(); save();
    return D.short + ': montada en ' + (G.Weapons.get(D.w) || {}).name.toLowerCase();
  }
  function lvOf(b) { return S.skills[b.id] || 0; }
  function skillBody() {
    return '<p class="sv-lead">Cada rama se abre con su manual. Los niveles se aprenden con suplementos.</p><ul class="sv-list sv-skills">' + BRANCHES.map((b) => {
      const n = lvOf(b), open = !!S.manuals[b.manual], nx = b.levels[n];
      const lv = b.levels.map((l, i) => '<span class="' + (i < n ? 'on' : '') + '">' + esc(l.txt) + (i >= n ? ' <i>' + l.cost + '</i>' : '') + '</span>').join('');
      return '<li><button type="button" data-f data-k="learn" data-d="' + b.id + '" class="' + (!open || !nx ? 'no' : '') + '"><b>' + b.name + '</b><em>' + (open ? (nx ? 'Siguiente: ' + nx.cost + ' suplementos' : 'Completa') : 'Hace falta: ' + b.manualName.toLowerCase()) + '</em><div class="sv-lv">' + lv + '</div></button></li>';
    }).join('') + '</ul>';
  }
  function learn(id) {
    const b = BRANCHES.find((q) => q.id === id);
    if (!b) return '';
    if (!S.manuals[b.manual]) return 'Te falta ' + b.manualName.toLowerCase();
    const n = lvOf(b), nx = b.levels[n];
    if (!nx) return 'Ya la tienes completa';
    if (S.sup < nx.cost) return 'Te faltan suplementos (' + S.sup + ' de ' + nx.cost + ')';
    S.sup -= nx.cost; S.skills[b.id] = n + 1;
    snd('uiOk'); save();
    return nx.txt + ': aprendida';
  }

  // ================= Viajar =================
  function travel(from, to) {
    const p = P(), H = hourDef(S.hour), T = test || {};
    const lack = [];
    if (S.res.comida > 0) S.res.comida--; else lack.push('comida');
    if (S.res.agua > 0) S.res.agua--; else lack.push('agua');
    let lost = false;
    const cureP = T.cura === 'siempre' ? 1 : (T.cura === 'nunca' ? 0 : 0.25);
    if ((p.items.venda || 0) > 0 && Math.random() < cureP) { p.items.venda--; lost = true; }
    S.stats.travels++;
    keepPlayer();
    const ambP = T.amb === 'siempre' ? 1 : (T.amb === 'nunca' ? 0 : H.amb);
    const trip = { from, to, lack, lost };
    save();
    if (Math.random() < ambP) {
      S.stats.ambushes++;
      if (Math.random() < H.warn) warnUI(trip);
      else host.shift(() => enterAmbush(trip), () => host.toast('¡Te salen al paso en el camino de la costa!', 'bad'));
    } else arrive(trip);
  }
  function arriveMsgs(trip) {
    const p = P(), m = [];
    if (trip.lack.length) { p.health = Math.max(10, p.health - 18 * trip.lack.length); m.push('Llegas agotada: sin ' + trip.lack.join(' ni ') + ' en todo el camino'); }
    if (trip.lost) m.push('Por el camino se te ha caído una venda');
    return m;
  }
  function arrive(trip) {
    host.shift(() => {
      enterZone(trip.to, { rest: true });
      const m = arriveMsgs(trip);
      S.rest = trip.to;
      keepPlayer(); snapRest = clone(S); save();
      trip.msgs = m;
    }, () => {
      host.toast('Llegas ' + toName(ZONES[trip.to].name), 'good');
      (trip.msgs || []).forEach((t, i) => setTimeout(() => host.toast(t, 'warn'), 900 + i * 1400));
    });
  }
  // el aviso: de día se ven venir de lejos (rodear cuesta algo de comida); a última hora, soltando parte de la carga
  function warnUI(trip) {
    const H = hourDef(S.hour), o = { kind: 'warn', sel: 0 };
    const avoid = H.day ? 'Dar un rodeo (más camino: 1 comida más)' : 'Soltar parte de la carga y rodear';
    o.render = () => {
      uiRoot.innerHTML = '<div class="sv-card sv-warn"><small>EL CAMINO DE LA COSTA</small><h3>' + (H.day ? 'Movimiento más adelante' : 'Algo se mueve entre los coches') + '</h3>' +
        '<div class="sv-txt">' + para(H.day ? 'Desde la loma se ve el camino entero: entre los coches parados hay siluetas que no se mueven como personas. Te esperan. Si das un rodeo, no te verán.' : 'Está oscuro y casi no se ve, pero lo oyes: pasos que se arrastran, entre los coches parados. Si sigues, te van a salir al paso.') + '</div>' +
        '<div class="sv-ft"><button type="button" data-f data-k="fight">Seguir y pelear</button><button type="button" data-f data-k="avoid">' + avoid + '</button></div></div>';
      focus(o);
    };
    o.key = (k) => {
      if (nav(o, k)) return;
      if (k === 'back') return;
      if (k === 'fight') { closeUI(); host.shift(() => enterAmbush(trip), () => host.toast('Dos oleadas: aguanta y sigue el camino', 'warn')); return; }
      if (k === 'avoid') {
        closeUI();
        if (H.day) { if (S.res.comida > 0) S.res.comida--; else trip.lack.push('comida'); }
        else {
          const drop = [];
          for (const k2 of ['comida', 'agua']) { const n = Math.ceil(S.res[k2] / 3); if (n) { S.res[k2] -= n; drop.push(n + ' de ' + k2); } }
          const ns = Math.floor(S.sup / 3); if (ns) { S.sup -= ns; drop.push(ns + ' suplementos'); }
          if (drop.length) trip.msgs0 = 'Para correr, sueltas parte de la carga: ' + drop.join(', ');
        }
        arrive(Object.assign(trip, { pre: true }));
        if (trip.msgs0) setTimeout(() => host.toast(trip.msgs0, 'warn'), 2600);
      }
    };
    openUI(o);
  }
  // la emboscada: el camino de la costa y dos oleadas; despejado, se sigue hasta el descanso de destino
  function enterAmbush(trip) {
    leaveHere();
    newScene();
    host.map('sv_camino');
    restorePlayer();
    applyHour();
    S.where = 'camino'; S.paso = null;
    host.place(7.0, 14.0, Math.PI / 2);
    host.peace(false);
    const T = test || {};
    R.amb = { trip, wave: 0, next: 2.2, list: [], done: false, strong: T.fuerza === 'fuerte' };
    hud(true);
  }
  function spawnWave(A) {
    const p = P(), H = hourDef(S.hour), W = G.World;
    A.wave++;
    const kinds = [];
    const nr = (A.wave === 1 ? 4 : 4) + (H.day ? 0 : 1) + (A.strong ? 2 : 0);
    for (let i = 0; i < nr; i++) kinds.push('runner');
    if (A.wave === 2) { kinds.push('stalker'); if (!H.day) kinds.push('blind'); if (A.strong) kinds.push('temb'); }
    A.list = [];
    for (const kind of kinds) {
      for (let t = 0; t < 50; t++) {
        const side = A.wave === 2 && Math.random() < 0.4;
        const x = side ? rnd(p.pos.x + 6, Math.min(64, p.pos.x + 26)) : rnd(Math.min(60, p.pos.x + 22), 64);
        const z = side ? (Math.random() < 0.5 ? rnd(7, 9) : rnd(19, 21.5)) : rnd(11, 17);
        if (W.circleBlocked(x, z, 0.4, 0) || Math.hypot(x - p.pos.x, z - p.pos.z) < 12) continue;
        const zb = new G.Zombie(host.scene, x, z, null, Math.atan2(p.pos.x - x, p.pos.z - z), { lv: 0, hunter: true, stalker: kind === 'stalker', blind: kind === 'blind', temb: kind === 'temb' });
        zb.svAmb = true;
        if (kind === 'runner' || kind === 'temb') { zb.state = 'chase'; zb.target = { x: p.pos.x, z: p.pos.z, lv: 0 }; zb.lastSeen = 0; zb.screamed = true; }
        else { zb.target = { x: p.pos.x + rnd(-4, 4), z: p.pos.z + rnd(-4, 4), lv: 0 }; zb.enter('investigate', 10); }
        G.Population.list.push(zb); A.list.push(zb);
        break;
      }
    }
    host.toast(A.wave === 1 ? 'Te salen al paso: oleada 1 de 2' : 'Vienen más: oleada 2 de 2', 'bad');
  }
  function updateAmbush(dt) {
    const A = R.amb;
    if (!A || A.done) return;
    if (A.next > 0) { A.next -= dt; if (A.next <= 0) spawnWave(A); return; }
    if (A.list.some((z) => z.alive)) return;
    if (A.wave < 2) { A.next = 3.0; return; }
    A.done = true;
    const got = 6 + Math.floor(Math.random() * 8);
    S.sup += got;
    host.toast('El camino queda libre. Entre los caídos: ' + got + ' suplementos', 'good');
    prop({ x: 64.5, z: 14.0, reach: 3.0, label: 'Seguir el camino · ' + ZONES[A.trip.to].name, use: () => { arrive(A.trip); return null; } });
    trailMark(65.2, 11.6);
  }

  // ================= Lo que se coge (player.itemRoom / takeItem) =================
  function room(id) {
    if (RES[id]) { const k = RES[id].k; return k === 'sup' ? 999 : Math.max(0, RES[id].cap - S.res[k]); }
    if (/^sv_p_/.test(id)) return S.parts[id.slice(5)] ? 0 : 1;
    if (/^sv_m_/.test(id)) return S.manuals[id.slice(5)] ? 0 : 1;
    return 0;
  }
  function takeItem(id, n) {
    if (!S) return { msg: '', left: n };
    if (RES[id]) {
      const k = RES[id].k;
      if (k === 'sup') { S.sup += n; return { msg: '+' + n + ' suplementos', left: 0 }; }
      const t = Math.min(n, room(id));
      S.res[k] += t;
      if (t <= 0) return { msg: 'No te cabe más ' + RES[id].name, left: n };
      return { msg: RES_NAME[k] + ' (' + S.res[k] + ')', left: n - t };
    }
    if (/^sv_p_/.test(id)) {
      const D = PARTS[id.slice(5)];
      S.parts[id.slice(5)] = 1;
      return { msg: 'Pieza: ' + D.short + ' (para ' + ((G.Weapons.get(D.w) || {}).name || D.w).toLowerCase() + '). Se monta en la mesa del escondite', left: 0 };
    }
    if (/^sv_m_/.test(id)) {
      const k = id.slice(5), b = BRANCHES.find((q) => q.manual === k);
      S.manuals[k] = true;
      return { msg: 'Manual: ' + (b ? b.manualName : k) + '. Abre la rama de ' + (b ? b.name.toLowerCase() : '') + ' (se aprende al descansar)', left: 0 };
    }
    return { msg: '', left: n };
  }

  // ================= Las pantallas =================
  let ui = null, uiRoot = null, padPrev = {};
  const hintKeys = () => (G.Input && G.Input.isTouch ? '' : ' <small>(Esc)</small>');
  function ensureUI() {
    if (uiRoot) return;
    uiRoot = document.createElement('div'); uiRoot.id = 'sv-ui'; uiRoot.className = 'hidden';
    document.body.appendChild(uiRoot);
    uiRoot.addEventListener('pointerdown', (e) => e.stopPropagation());
    uiRoot.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b || !ui) return;
      e.preventDefault();
      const fs = Array.from(uiRoot.querySelectorAll('[data-f]')), i = fs.indexOf(b);
      if (i >= 0) ui.sel = i;
      ui.key(b.dataset.k, b.dataset.d);
    });
    window.addEventListener('keydown', (e) => {
      if (!ui) return;
      const K = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
        Enter: 'ok', Space: 'ok', KeyE: 'ok', KeyF: 'ok', KeyT: 'ok', Escape: 'back', Backspace: 'back', KeyQ: 'back', KeyB: 'back' }[e.code];
      e.preventDefault(); e.stopPropagation();
      if (!K || e.repeat || performance.now() - ui.t0 < 220) return;
      ui.key(K);
    }, true);
  }
  function openUI(o) {
    ensureUI();
    o.t0 = performance.now(); o.sel = o.sel || 0;
    ui = o; padPrev = {};
    uiRoot.className = 'sv-' + o.kind;
    o.render();
    snd('uiOk');
    if (G.Input && !G.Input.isTouch && G.Input.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  }
  function closeUI() {
    if (!ui) return;
    const o = ui; ui = null;
    uiRoot.className = 'hidden'; uiRoot.innerHTML = '';
    snd('uiBack');
    if (o.onClose) o.onClose();
    if (G.Input && !G.Input.isTouch && G.Input.enabled && G.Input.requestLock && !ui) G.Input.requestLock();
  }
  // moverse entre los botones (↑ ↓) y pulsar el elegido (Aceptar)
  function focus(o) {
    const fs = uiRoot.querySelectorAll('[data-f]');
    if (!fs.length) return;
    o.sel = Math.max(0, Math.min(o.sel || 0, fs.length - 1));
    fs.forEach((b, i) => b.classList.toggle('foc', i === o.sel));
    if (fs[o.sel].scrollIntoView) fs[o.sel].scrollIntoView({ block: 'nearest' });
  }
  function nav(o, k) {
    const fs = Array.from(uiRoot.querySelectorAll('[data-f]'));
    if (k === 'up' || k === 'down') { if (!fs.length) return true; o.sel = (o.sel + (k === 'up' ? fs.length - 1 : 1)) % fs.length; focus(o); snd('ui'); return true; }
    if (k === 'ok') { const b = fs[o.sel]; if (b) o.key(b.dataset.k, b.dataset.d); return true; }
    return false;
  }
  function padUI() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : [];
    let pd = null; for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { pd = ps[i]; break; }
    if (!pd || !ui) return;
    const ax = pd.axes || [], bt = (i) => !!(pd.buttons[i] && pd.buttons[i].pressed);
    const now = { up: bt(12) || ax[1] < -0.6, down: bt(13) || ax[1] > 0.6, left: bt(14) || bt(4) || ax[0] < -0.6, right: bt(15) || bt(5) || ax[0] > 0.6, ok: bt(0), back: bt(1) };
    const prev = padPrev; padPrev = now;
    if (performance.now() - ui.t0 < 250) return;
    for (const k in now) if (now[k] && !prev[k]) { ui.key(k); return; }
  }
  function noteUI(title, text) {
    snd('rustle', { vol: 0.35 });
    const o = { kind: 'note' };
    o.render = () => { uiRoot.innerHTML = '<div class="sv-card sv-paper"><h3>' + esc(title) + '</h3><div class="sv-txt">' + para(text) + '</div><div class="sv-ft"><button type="button" data-f data-k="back">Cerrar' + hintKeys() + '</button></div></div>'; focus(o); };
    o.key = (k) => { if (k === 'ok' || k === 'back') closeUI(); };
    openUI(o);
  }
  // al empezar una partida: quién eres y cómo va esto
  function introUI(done) {
    const o = { kind: 'intro' };
    o.render = () => {
      uiRoot.innerHTML = '<div class="sv-card sv-intro"><small>MODO SUPERVIVENCIA · BETA</small><h3>La Trece</h3><div class="sv-txt">' +
        para('Los Escorpiones acabaron con tu gente. De los Supervivientes, quedas tú: Eira, la Trece.\nEste es tu escondite, en la costa de Oceanside. Desde aquí, la vía lleva al asentamiento y la playa a la casa del pescador; más allá del asentamiento está el faro.\nEn los descansos (el saco y los fuegos) se guarda, se cura comiendo algo, se elige la hora a la que salir, se cocina y se viaja a otro fuego ya encendido (cuesta comida y agua). Las piezas de las armas se montan en tu mesa; los manuales abren habilidades.\nSi caes, despiertas en el último descanso con lo que llevabas entonces.') +
        '</div><div class="sv-ft"><button type="button" data-f data-k="back">Empezar</button></div></div>';
      focus(o);
    };
    o.key = (k) => { if (k === 'ok' || k === 'back') closeUI(); };
    o.onClose = done;
    openUI(o);
  }

  // ---------- la prueba (modo libre) ----------
  const TEST_DEF = { zone: 'escondite', hour: 'manana', comida: 3, agua: 3, venda: 2, sup: 0, amb: 'normal', fuerza: 'normal', cura: 'normal', rests: 'uno', kit: 'superv', skills: 'cerradas', parts: 'no' };
  let testSel = null;
  function openTest(p) {
    const T = testSel = Object.assign({}, TEST_DEF, testSel || {});
    const rows = [
      ['zone', 'Empezar en', Object.keys(ZONES).map((z) => [z, ZONES[z].name])],
      ['hour', 'Hora', HOURS.map((h) => [h.id, h.name])],
      ['comida', 'Comida', [0, 1, 2, 3, 5, 8].map((n) => [n, String(n)])],
      ['agua', 'Agua', [0, 1, 2, 3, 5, 8].map((n) => [n, String(n)])],
      ['venda', 'Vendas', [0, 1, 2, 4].map((n) => [n, String(n)])],
      ['sup', 'Suplementos', [0, 30, 100, 300].map((n) => [n, String(n)])],
      ['amb', 'Emboscada al viajar', [['normal', 'Según la hora'], ['siempre', 'Siempre'], ['nunca', 'Nunca']]],
      ['fuerza', 'Fuerza de la emboscada', [['normal', 'Normal'], ['fuerte', 'Fuerte']]],
      ['cura', 'Perder una venda al viajar', [['normal', '1 de cada 4'], ['siempre', 'Siempre'], ['nunca', 'Nunca']]],
      ['rests', 'Descansos encendidos', [['uno', 'Solo el escondite'], ['todos', 'Todos']]],
      ['kit', 'Equipo', [['superv', 'El de empezar'], ['actual', 'Lo que llevas ahora']]],
      ['skills', 'Manuales', [['cerradas', 'Hay que encontrarlos'], ['abiertas', 'Todos']]],
      ['parts', 'Piezas', [['no', 'Hay que encontrarlas'], ['todas', 'Todas']]]
    ];
    const o = { kind: 'test', sel: 0 };
    o.render = () => {
      uiRoot.innerHTML = '<div class="sv-card sv-test"><div class="sv-head"><small>MODO LIBRE · PRUEBA</small><h3>Modo supervivencia</h3><p class="sv-lead">Juegas con Eira. Elige con qué empiezas y fuerza lo que quieras probar. No se guarda nada; desde cualquier descanso vuelves al modo libre.</p></div>' +
        '<div class="sv-body"><ul class="sv-form">' + rows.map(([k, name, opts]) => '<li><span>' + name + '</span><div>' + opts.map(([v, t]) => '<button type="button" data-f data-k="opt" data-d="' + k + ':' + v + '" class="' + (String(T[k]) === String(v) ? 'on' : '') + '">' + esc(t) + '</button>').join('') + '</div></li>').join('') + '</ul></div>' +
        '<div class="sv-ft"><button type="button" data-f data-k="start" class="main">Empezar la prueba</button><button type="button" data-f data-k="back">Cancelar' + hintKeys() + '</button></div></div>';
      focus(o);
    };
    o.key = (k, d) => {
      if (k === 'left' || k === 'right') {
        // (con el mando o las flechas: ← → cambia la opción de la fila elegida)
        const fs = Array.from(uiRoot.querySelectorAll('[data-f]')), b = fs[o.sel];
        if (b && b.dataset.k === 'opt') { const row = b.parentElement, bs = Array.from(row.querySelectorAll('[data-f]')), i = bs.indexOf(b), nb = bs[(i + (k === 'left' ? bs.length - 1 : 1)) % bs.length]; o.sel = fs.indexOf(nb); nb.click(); }
        return;
      }
      if (nav(o, k)) return;
      if (k === 'back') { closeUI(); return; }
      if (k === 'opt') { const [kk, v] = d.split(':'); T[kk] = isNaN(+v) ? v : +v; snd('ui'); o.render(); return; }
      if (k === 'start') { closeUI(); startTest(p, Object.assign({}, T)); }
    };
    openUI(o);
  }
  function startTest(p, T) {
    prevChar = p.charId;
    if (G.Run && G.Run.active) G.Run.keep(p);
    const cur = T.kit === 'actual' ? G.Run.snap(p) : null;
    host.load(() => {
      host.setMode('superv');
      if (G.Refugio) G.Refugio.leave();
      if (p.charId !== 'eira') p.setCharacter('eira');
      test = T;
      begin(null, T, cur);
    }, null, 3.0);
  }
  function backToFree() {
    const pc = prevChar;
    stop();
    host.backToFree(pc);
  }

  // ================= El HUD =================
  function hud(now) {
    if (!hudEl) { hudEl = document.createElement('div'); hudEl.id = 'sv-hud'; document.body.appendChild(hudEl); barEl = document.createElement('div'); barEl.id = 'sv-bar'; barEl.className = 'hidden'; barEl.innerHTML = '<i></i><b>Girando la manivela</b>'; document.body.appendChild(barEl); }
    if (!active || !S) { hudEl.className = 'hidden'; barEl.className = 'hidden'; return; }
    hudEl.className = '';
    const where = S.where === 'paso' && S.paso ? PASOS[S.paso.id].name : (S.where === 'camino' ? 'El camino de la costa' : ZONES[S.zone].name);
    hudEl.innerHTML = '<b>' + esc(where) + '</b><span class="r-comida"><i></i>' + S.res.comida + '</span><span class="r-agua"><i></i>' + S.res.agua + '</span><span class="r-sup"><i></i>' + S.sup + '</span>' + (test ? '<em>prueba</em>' : '<em>beta</em>');
  }

  // ================= Empezar, seguir, morir =================
  // cont: la partida guardada (null: nueva); T: la prueba (con lo elegido); cur: el equipo de antes (la prueba)
  function begin(saved, T, cur) {
    active = true;
    registerKinds();
    S = saved ? saved.live : fresh();
    snapRest = saved ? (saved.snap || clone(saved.live)) : null;
    if (T) {
      S.hour = T.hour; S.res.comida = T.comida; S.res.agua = T.agua; S.sup = T.sup; S.zone = S.rest = T.zone;
      if (T.rests === 'todos') for (const z in ZONES) S.visited[z] = true;
      else S.visited[T.zone] = true;
      if (T.skills === 'abiertas') for (const b of BRANCHES) S.manuals[b.manual] = true;
      if (T.parts === 'todas') for (const id in PARTS) S.parts[id] = 1;
      S.intro = true;
    }
    const p = P();
    // el equipo: el de empezar (o lo que se llevaba, en la prueba)
    if (!S.inv) {
      if (cur) { G.Run.unsnap(p, cur); p.health = 100; }
      else kitNew(p);
      if (T) p.items.venda = T.venda;
      S.inv = G.Run.snap(p);
    }
    if (!snapRest) snapRest = clone(S);
    enterZone(S.rest, { rest: true });
    if (!S.intro) { S.intro = true; save(); setTimeout(() => { if (active) introUI(); }, 1400); }
  }
  function start(cont) {
    prevChar = null; test = null;
    const sv = cont ? readSave() : null;
    if (!cont) { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } }
    begin(sv, null, null);
  }
  function respawn() {
    S = clone(snapRest || S);
    host.shift(() => { enterZone(S.rest, { rest: true }); }, () => host.toast('Despiertas en ' + lc(ZONES[S.rest].name) + '. Lo que cogiste desde que descansaste, se perdió', 'warn'));
  }
  function quit() { if (!active || !S) return; if (!(P() && P().dead)) leaveHere(); save(); }
  function stop() {
    closeUI();
    clearScene();
    active = false;
    restFade = false;
    S = null; snapRest = null; test = null;
    Surv.pasoKind = null;
    hud(false);
  }
  function busy() { return !!ui || restFade; }

  // ================= Cada fotograma =================
  function update(dt, p) {
    if (!active || !R) return;
    R.t += dt;
    if (ui) padUI();
    updateFires(dt);
    for (const a of R.anims) a(dt);
    updateGate(dt, p);
    updateAmbush(dt);
    if ((R.findT -= dt) <= 0) { R.findT = 0.5; syncFinds(); }
    if ((hudT -= dt) <= 0) { hudT = 0.25; hud(); }
    // la barra de la manivela
    if (barEl) {
      const on = !!(R.crank || (R.gate && R.gate.k > 0 && !R.gate.open && !R.gate.falling));
      barEl.className = on && R.crank ? '' : 'hidden';
      if (on) barEl.querySelector('i').style.width = Math.round((R.gate ? R.gate.k : 0) * 100) + '%';
    }
  }

  const Surv = {
    init(h) { host = h; registerKinds(); },
    HOURS, ZONES, PASOS, PARTS, BRANCHES, RECIPES,
    start, begin, stop, quit, respawn, update, openTest,
    room, takeItem,
    pasoKind: null,
    get active() { return active; },
    get test() { return !!test; },
    get busy() { return !!ui || (active && restFade); },          // (el panel de la prueba se abre también desde el modo libre)
    get state() { return S; },
    get here() { return R; },
    get saved() { const d = readSave(); return d ? { zone: d.live.rest, rests: d.live.stats ? d.live.stats.rests : 0 } : null; },
    // (girando la manivela: el botón de Recoger sigue en pantalla mientras se mantiene)
    get cranking() { return !!(active && R && R.crank); },
    upgraded(wid, uid) { return !!(S && S.up[wid] && S.up[wid][uid]); },
    get noListen() { return active && !!S && !(S.skills.sigilo >= 1); },
    // lo que suman las habilidades aprendidas (G.Skills.bonus)
    bonus(key) {
      if (!S) return 0;
      let v = 0;
      for (const b of BRANCHES) { const n = S.skills[b.id] || 0; for (let i = 0; i < n; i++) if (b.levels[i].key === key) v += b.levels[i].val; }
      return v;
    },
    // los cuerpos de infectados a tener armados (detrás del fundido): según la zona y la hora
    poolNeed() {
      if (!S) return { z: 6 };
      const H = hourDef(S.hour);
      if (S.where === 'camino' || (R && R.amb)) return { z: 8, stalker: 1, blind: 1, temb: 1 };
      if (S.where === 'paso') return { z: 1 };
      const Z = ZONES[S.zone];
      return { z: Math.round(Z.zombies * H.zk) + 2, stalker: Z.hub ? 0 : H.stalk, blind: Z.hub ? 0 : H.blind };
    },
    // el texto de la pantalla de muerte
    deadText() { return 'Despertarás en ' + (S && ZONES[S.rest] ? lc(ZONES[S.rest].name) : 'el escondite') + ', el último sitio donde descansaste. Lo que cogiste desde entonces, se pierde.'; }
  };
  // (para las pruebas automáticas)
  Surv._t = { enterZone, enterPaso, enterAmbush, travel, restStart, openRest, restEnd, goPaso, goZone, arrive, warnUI, closeUI, get R() { return R; }, get ui() { return ui; } };
  G.Surv = Surv;
})(window.Game = window.Game || {});
