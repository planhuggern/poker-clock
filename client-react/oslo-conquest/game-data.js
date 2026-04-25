// Alle spillets konstanter: farger, bydeler, territorier, nabolister og oppdrag.
// Ingen spillogikk her — bare data som de andre modulene leser.

export const PLAYER_COLORS = ['#c0392b','#1a6b9a','#1a7a4a','#c0692b','#6b3fa0','#1a8a8a'];
export const PLAYER_COLOR_NAMES = ['Rød','Blå','Grønn','Oransje','Lilla','Cyan'];

// Bydeler med navn, bonusverdier og bakgrunnsfarge på kartet.
export const DISTRICTS = {
  'gamle-oslo':         { name: 'Gamle Oslo',         bonus: { money: 300, units: 2 }, color: '#2d1f3d' },
  'grunerløkka':        { name: 'Grünerløkka',        bonus: { money: 250, units: 2 }, color: '#1f2d3d' },
  'sagene':             { name: 'Sagene',              bonus: { money: 200, units: 1 }, color: '#1f3d2d' },
  'st-hanshaugen':      { name: 'St. Hanshaugen',     bonus: { money: 250, units: 2 }, color: '#3d2d1f' },
  'frogner':            { name: 'Frogner',             bonus: { money: 400, units: 3 }, color: '#2d3d1f' },
  'ullern':             { name: 'Ullern',              bonus: { money: 350, units: 2 }, color: '#3d1f2d' },
  'vestre-aker':        { name: 'Vestre Aker',         bonus: { money: 300, units: 2 }, color: '#1f3d3d' },
  'nordre-aker':        { name: 'Nordre Aker',         bonus: { money: 300, units: 2 }, color: '#2d2d1f' },
  'bjerke':             { name: 'Bjerke',              bonus: { money: 200, units: 1 }, color: '#1f2d2d' },
  'grorud':             { name: 'Grorud',              bonus: { money: 200, units: 1 }, color: '#2d1f2d' },
  'stovner':            { name: 'Stovner',             bonus: { money: 200, units: 1 }, color: '#2d2d2d' },
  'alna':               { name: 'Alna',                bonus: { money: 250, units: 2 }, color: '#1f1f2d' },
  'østensjø':           { name: 'Østensjø',            bonus: { money: 250, units: 2 }, color: '#2d1f1f' },
  'nordstrand':         { name: 'Nordstrand',          bonus: { money: 300, units: 2 }, color: '#1f2d1f' },
  'søndre-nordstrand':  { name: 'Søndre Nordstrand',  bonus: { money: 250, units: 2 }, color: '#2d2d1f' },
};

// Alle 35 territorier med id, navn, hvilken bydel de tilhører, kjøpspris,
// antall nøytrale bataljoner ved spillstart og normalisert kartposisjon (x/y 0–1).
export const TERRITORIES = [
  { id: 't1',  name: 'Grønland',          district: 'gamle-oslo',        price: 300, neutralUnits: 2, x: 0.54, y: 0.62 },
  { id: 't2',  name: 'Gamlebyen',         district: 'gamle-oslo',        price: 280, neutralUnits: 2, x: 0.52, y: 0.66 },
  { id: 't3',  name: 'Tøyen',             district: 'gamle-oslo',        price: 260, neutralUnits: 1, x: 0.55, y: 0.58 },
  { id: 't4',  name: 'Løkka',             district: 'grunerløkka',       price: 320, neutralUnits: 2, x: 0.52, y: 0.52 },
  { id: 't5',  name: 'Sofienberg',        district: 'grunerløkka',       price: 280, neutralUnits: 1, x: 0.55, y: 0.54 },
  { id: 't6',  name: 'Rodeløkka',         district: 'grunerløkka',       price: 260, neutralUnits: 1, x: 0.50, y: 0.56 },
  { id: 't7',  name: 'Torshov',           district: 'sagene',            price: 240, neutralUnits: 1, x: 0.49, y: 0.49 },
  { id: 't8',  name: 'Sandaker',          district: 'sagene',            price: 220, neutralUnits: 1, x: 0.47, y: 0.47 },
  { id: 't9',  name: 'Bislett',           district: 'st-hanshaugen',     price: 320, neutralUnits: 2, x: 0.46, y: 0.54 },
  { id: 't10', name: 'Adamstuen',         district: 'st-hanshaugen',     price: 280, neutralUnits: 1, x: 0.44, y: 0.52 },
  { id: 't11', name: 'Majorstuen',        district: 'frogner',           price: 460, neutralUnits: 3, x: 0.40, y: 0.54 },
  { id: 't12', name: 'Frognerparken',     district: 'frogner',           price: 420, neutralUnits: 3, x: 0.37, y: 0.56 },
  { id: 't13', name: 'Bygdøy',            district: 'frogner',           price: 400, neutralUnits: 2, x: 0.34, y: 0.62 },
  { id: 't14', name: 'Skøyen',            district: 'ullern',            price: 380, neutralUnits: 2, x: 0.31, y: 0.58 },
  { id: 't15', name: 'Montebello',        district: 'ullern',            price: 360, neutralUnits: 2, x: 0.28, y: 0.54 },
  { id: 't16', name: 'Vinderen',          district: 'vestre-aker',       price: 340, neutralUnits: 2, x: 0.33, y: 0.46 },
  { id: 't17', name: 'Røa',               district: 'vestre-aker',       price: 320, neutralUnits: 2, x: 0.29, y: 0.42 },
  { id: 't18', name: 'Holmenkollen',      district: 'vestre-aker',       price: 360, neutralUnits: 2, x: 0.30, y: 0.36 },
  { id: 't19', name: 'Kjelsås',           district: 'nordre-aker',       price: 300, neutralUnits: 2, x: 0.44, y: 0.38 },
  { id: 't20', name: 'Nydalen',           district: 'nordre-aker',       price: 320, neutralUnits: 2, x: 0.46, y: 0.42 },
  { id: 't21', name: 'Maridalen',         district: 'nordre-aker',       price: 260, neutralUnits: 1, x: 0.40, y: 0.32 },
  { id: 't22', name: 'Økern',             district: 'bjerke',            price: 240, neutralUnits: 1, x: 0.56, y: 0.46 },
  { id: 't23', name: 'Risløkka',          district: 'bjerke',            price: 220, neutralUnits: 1, x: 0.59, y: 0.44 },
  { id: 't24', name: 'Romsås',            district: 'grorud',            price: 220, neutralUnits: 1, x: 0.62, y: 0.38 },
  { id: 't25', name: 'Grorud sentrum',    district: 'grorud',            price: 200, neutralUnits: 1, x: 0.65, y: 0.42 },
  { id: 't26', name: 'Stovner sentrum',   district: 'stovner',           price: 200, neutralUnits: 1, x: 0.70, y: 0.38 },
  { id: 't27', name: 'Haugenstua',        district: 'stovner',           price: 200, neutralUnits: 1, x: 0.73, y: 0.42 },
  { id: 't28', name: 'Furuset',           district: 'alna',              price: 260, neutralUnits: 2, x: 0.71, y: 0.50 },
  { id: 't29', name: 'Helsfyr',           district: 'alna',              price: 280, neutralUnits: 2, x: 0.63, y: 0.52 },
  { id: 't30', name: 'Manglerud',         district: 'østensjø',          price: 260, neutralUnits: 2, x: 0.63, y: 0.62 },
  { id: 't31', name: 'Oppsal',            district: 'østensjø',          price: 240, neutralUnits: 1, x: 0.67, y: 0.64 },
  { id: 't32', name: 'Ljan',              district: 'nordstrand',        price: 300, neutralUnits: 2, x: 0.60, y: 0.72 },
  { id: 't33', name: 'Nordstrand sentrum',district: 'nordstrand',        price: 320, neutralUnits: 2, x: 0.56, y: 0.76 },
  { id: 't34', name: 'Holmlia',           district: 'søndre-nordstrand', price: 240, neutralUnits: 1, x: 0.55, y: 0.82 },
  { id: 't35', name: 'Mortensrud',        district: 'søndre-nordstrand', price: 220, neutralUnits: 1, x: 0.59, y: 0.80 },
];

// Hvilke territorier som grenser til hverandre — brukes for å avgjøre om et angrep er lovlig.
export const ADJACENCY = {
  't1':  ['t2','t3','t4','t5','t9'],
  't2':  ['t1','t3','t32','t30'],
  't3':  ['t1','t2','t4','t5'],
  't4':  ['t3','t5','t6','t7','t9'],
  't5':  ['t1','t3','t4','t6'],
  't6':  ['t4','t5','t7'],
  't7':  ['t4','t6','t8','t9'],
  't8':  ['t7','t9','t10','t19','t20'],
  't9':  ['t1','t4','t7','t8','t10'],
  't10': ['t8','t9','t11','t19'],
  't11': ['t10','t12','t16','t19','t20'],
  't12': ['t11','t13','t16'],
  't13': ['t12','t14'],
  't14': ['t13','t15','t16'],
  't15': ['t14','t16','t17'],
  't16': ['t11','t12','t14','t15','t17','t18'],
  't17': ['t15','t16','t18'],
  't18': ['t16','t17','t21'],
  't19': ['t8','t10','t11','t20','t21'],
  't20': ['t8','t11','t19','t22'],
  't21': ['t18','t19'],
  't22': ['t20','t23','t29'],
  't23': ['t22','t24','t25'],
  't24': ['t23','t25','t26'],
  't25': ['t23','t24','t27','t28'],
  't26': ['t24','t25','t27'],
  't27': ['t25','t26','t28'],
  't28': ['t25','t27','t29','t31'],
  't29': ['t22','t28','t30','t31'],
  't30': ['t2','t29','t31','t32'],
  't31': ['t28','t29','t30','t35'],
  't32': ['t2','t30','t33'],
  't33': ['t32','t34','t35'],
  't34': ['t33','t35'],
  't35': ['t31','t33','t34'],
};

// De tre runde-sjekkpunktene spillere må innom for å få bonusen på 500 kr + 3 bat.
export const CHECKPOINTS = {
  'lørenskog': { name: 'Lørenskog', x: 0.82, y: 0.50 },
  'lysaker':   { name: 'Lysaker',   x: 0.24, y: 0.60 },
  'kolbotn':   { name: 'Kolbotn',   x: 0.62, y: 0.88 },
};

// Hjelpefunksjon: sjekker om en spiller eier alle territorier i de oppgitte bydelene.
function checkDistrictOwnership(player, gs, districtIds) {
  return districtIds.every(did => {
    const terrs = TERRITORIES.filter(t => t.district === did);
    return terrs.every(t => gs.territories[t.id]?.owner === player.id);
  });
}

// De 11 hemmelige oppdragene. Hvert oppdrag har en check()-funksjon som returnerer
// true når seiersbetingelsen er oppfylt. MISSIONS[i].secret = true betyr at målet ikke vises.
export const MISSIONS = [
  {
    id: 'm1', emoji: '🗺️', title: 'Vestkanten',
    desc: 'Eie alle områder i Frogner, Ullern og Vestre Aker',
    check: (p, gs) => checkDistrictOwnership(p, gs, ['frogner','ullern','vestre-aker']),
  },
  {
    id: 'm2', emoji: '🏙️', title: 'Østkanten',
    desc: 'Eie alle områder i Alna, Østensjø og Nordstrand',
    check: (p, gs) => checkDistrictOwnership(p, gs, ['alna','østensjø','nordstrand']),
  },
  {
    id: 'm3', emoji: '🌲', title: 'Nordmarka-porten',
    desc: 'Eie alle områder i Nordre Aker og Vestre Aker',
    check: (p, gs) => checkDistrictOwnership(p, gs, ['nordre-aker','vestre-aker']),
  },
  {
    id: 'm4', emoji: '🔴', title: 'Sentrumsherren',
    desc: 'Eie alle områder i Gamle Oslo, Grünerløkka og St. Hanshaugen',
    check: (p, gs) => checkDistrictOwnership(p, gs, ['gamle-oslo','grunerløkka','st-hanshaugen']),
  },
  {
    id: 'm5', emoji: '🏘️', title: 'Storby',
    desc: 'Eie totalt 20 enkeltområder',
    check: (p, gs) => Object.values(gs.territories).filter(t => t.owner === p.id).length >= 20,
  },
  {
    id: 'm6', emoji: '⚔️', title: 'Conquistador',
    desc: 'Eie minst ett område i alle 15 bydeler',
    check: (p, gs) => {
      const owned = new Set(
        Object.values(gs.territories)
          .filter(t => t.owner === p.id)
          .map(t => TERRITORIES.find(x => x.id === t.id)?.district)
      );
      return Object.keys(DISTRICTS).every(d => owned.has(d));
    },
  },
  {
    id: 'm7', emoji: '💰', title: 'Kapitalist',
    desc: 'Ha 5000 kr og eie minst 10 områder',
    check: (p, gs) =>
      p.money >= 5000 && Object.values(gs.territories).filter(t => t.owner === p.id).length >= 10,
  },
  {
    id: 'm8', emoji: '🗡️', title: 'Blodhevn',
    desc: 'Slå ut din utvalgte fiende',
    secret: true,
    check: (p, gs) => p.target && gs.players.find(x => x.id === p.target)?.eliminated === true,
  },
  {
    id: 'm9', emoji: '🛣️', title: 'Ringveien',
    desc: 'Eie minst ett område i hver bydel langs ruten fra Lørenskog til Kolbotn',
    check: (p, gs) => {
      const owned = new Set(
        Object.values(gs.territories)
          .filter(t => t.owner === p.id)
          .map(t => TERRITORIES.find(x => x.id === t.id)?.district)
      );
      return ['alna','stovner','grorud','bjerke','østensjø','nordstrand','søndre-nordstrand']
        .every(d => owned.has(d));
    },
  },
  {
    id: 'm10', emoji: '🎯', title: 'Festning',
    desc: 'Eie en komplett bydel med minst 10 bataljoner fordelt i den',
    check: (p, gs) => {
      for (const did of Object.keys(DISTRICTS)) {
        const dTerrs = TERRITORIES.filter(t => t.district === did);
        if (dTerrs.every(t => gs.territories[t.id]?.owner === p.id)) {
          const total = dTerrs.reduce((sum, t) => sum + (gs.territories[t.id]?.units || 0), 0);
          if (total >= 10) return true;
        }
      }
      return false;
    },
  },
  {
    id: 'm11', emoji: '🪓', title: 'Barbaren',
    desc: 'Angrip og vinn minst 2 områder fra HVER motspiller',
    check: (p, gs) => {
      const others = gs.players.filter(x => x.id !== p.id && !x.eliminated);
      return others.every(other => (p.conquests?.[other.id] || 0) >= 2);
    },
  },
];
