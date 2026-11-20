// Sample data loaded the first time the app opens, so every page has
// something to show. "Remove sample data" on the Home screen clears it.

export const GARMENTS = ['Basketball jersey', 'Race singlet', 'Shorts', 'T-shirt'];
export const GROUPS = ['Men', 'Women', 'Child'];
export const STAGES = ['Design', 'Printing', 'Sewing', 'Quality check', 'Ready for pickup'];
export const WAITING_REASONS = ['Waiting for player sizes', 'Waiting for design approval', 'Waiting for down payment', 'Waiting for customer'];

// Sample size chart in cm: size, chest, waist, neck, body length, shoulder.
const SAMPLE_CHART = {
  Men: [['XS', 86, 72, 36, 68, 41], ['S', 91, 77, 37, 70, 43], ['M', 96, 82, 38, 72, 45], ['L', 101, 87, 40, 74, 47], ['XL', 106, 92, 41, 76, 49], ['2XL', 112, 98, 43, 78, 51], ['3XL', 118, 104, 44, 80, 53]],
  Women: [['XS', 80, 64, 32, 62, 36], ['S', 84, 68, 33, 64, 37], ['M', 88, 72, 34, 66, 39], ['L', 93, 77, 35, 68, 40], ['XL', 98, 82, 36, 70, 42], ['2XL', 104, 88, 37, 72, 44], ['3XL', 110, 94, 38, 74, 46]],
  Child: [['4', 58, 53, 27, 44, 27], ['6', 62, 55, 28, 48, 29], ['8', 66, 58, 29, 52, 31], ['10', 70, 61, 30, 56, 33], ['12', 75, 64, 31, 60, 35], ['14', 80, 67, 32, 63, 37], ['16', 84, 70, 33, 66, 39]],
};

export function sampleCharts() {
  const charts = {};
  for (const g of GARMENTS) charts[g] = structuredClone(SAMPLE_CHART);
  return charts;
}

const p = (name, number, group, size, neck, waist, note = '') => ({ name, number, group, size, neck, waist, note });

export function sampleData() {
  const customers = [
    { id: 'c1', name: 'Northside Tigers', kind: 'Basketball team', contact: 'Coach Ray Dalisay', phone: '0900 000 0012', address: 'North District', since: '2024' },
    { id: 'c2', name: 'Harbor City Runners', kind: 'Running club', contact: 'Lina Cortez', phone: '0900 000 0034', address: 'City Center', since: '2025' },
    { id: 'c3', name: 'Hillcrest Academy', kind: 'School', contact: 'Ms. Clara Ramos', phone: '0900 000 0056', address: 'West District', since: '2023' },
    { id: 'c4', name: 'Riverside Community League', kind: 'Community league', contact: 'Mr. Joel Santos', phone: '0900 000 0078', address: 'Riverside District', since: '2026' },
    { id: 'c5', name: 'Bayview Volleyball Club', kind: 'Volleyball team', contact: 'Paolo Reyes', phone: '0900 000 0090', address: 'West District', since: '2026' },
    { id: 'c6', name: 'Coastline Cycling Group', kind: 'Cycling club', contact: 'Carl Medina', phone: '0900 000 0101', address: 'Coast District', since: '2026' },
    { id: 'c7', name: 'Sunrise Dental Care', kind: 'Company', contact: 'Dr. Nina Flores', phone: '0900 000 0123', address: 'Central District', since: '2026' },
    { id: 'c8', name: 'Eastwood Archers Softball', kind: 'Softball team', contact: 'Mia Torres', phone: '0900 000 0145', address: 'City Center', since: '2026' },
  ];
  const orders = [
    {
      id: 'o1', customerId: 'c1', garment: 'Basketball jersey', due: '2026-12-05', createdAt: '2026-11-10',
      players: [
        p('REYES', '7', 'Men', 'L', 40, 86), p('SANTOS', '11', 'Men', 'M', 38, 82), p('DELA CRUZ', '23', 'Men', 'XL', 41, 92, 'Captain patch'),
        p('GARCIA', '5', 'Men', 'L', 40, 88), p('MENDOZA', '32', 'Men', '2XL', 43, 99, 'Extra length +2 cm'),
        p('BAUTISTA', '3', 'Women', 'S', 33, 68), p('RAMOS', '14', 'Women', 'M', 34, 72), p('VILLANUEVA JR.', '1', 'Child', '10', 30, 61, 'Mascot jersey'),
      ],
    },
    {
      id: 'o2', customerId: 'c2', garment: 'Race singlet', due: '2026-11-25', createdAt: '2026-11-01',
      players: [p('TAN', '101', 'Women', 'M', 34, 72), p('LIM', '102', 'Men', 'S', 37, 77), p('GO', '103', 'Men', 'M', 38, 80), p('UY', '104', 'Women', 'S', 33, 66)],
    },
    {
      id: 'o3', customerId: 'c3', garment: 'T-shirt', due: '2026-08-21', createdAt: '2026-08-01',
      players: [p('CRUZ', '', 'Child', '8', 29, 58), p('NAVARRO', '', 'Child', '10', 30, 61), p('PEREZ', '', 'Child', '12', 31, 64), p('LOPEZ', '', 'Women', 'M', 34, 72)],
    },
    {
      id: 'o4', customerId: 'c4', garment: 'Basketball jersey', due: '2026-05-30', createdAt: '2026-05-01',
      players: [p('ABELLANA', '9', 'Men', 'L', 40, 88), p('YAP', '21', 'Men', 'XL', 41, 93), p('SY', '4', 'Men', 'M', 38, 81), p('ONG', '15', 'Men', '2XL', 43, 100)],
    },
  ];
  const projects = [
    { id: 'p1', customerId: 'c1', garment: 'Basketball jersey (home)', pieces: 8, price: 6800, status: 'ongoing', stage: 1, due: '2026-12-05', owner: 'Joy', pay: 'partial', file: 'northside-tigers-home.svg' },
    { id: 'p2', customerId: 'c2', garment: 'Race singlet', pieces: 24, price: 10800, status: 'ongoing', stage: 2, due: '2026-11-25', owner: 'Mark', pay: 'paid', file: 'harbor-runners-singlet.svg' },
    { id: 'p3', customerId: 'c3', garment: 'Intramurals shirt', pieces: 40, price: 14000, status: 'ongoing', stage: 3, due: '2026-11-22', owner: 'Ana', pay: 'partial', file: 'hillcrest-intrams.svg' },
    { id: 'p4', customerId: 'c5', garment: 'Volleyball jersey', pieces: 12, price: 9600, status: 'ongoing', stage: 0, due: '2026-12-12', owner: 'Billy', pay: 'unpaid' },
    { id: 'p5', customerId: 'c4', garment: 'Basketball jersey (season 2)', pieces: 60, price: 48000, status: 'pending', waiting: 'Waiting for player sizes', due: '2027-01-10', owner: 'Billy', pay: 'unpaid' },
    { id: 'p6', customerId: 'c6', garment: 'Cycling jersey', pieces: 18, price: 19800, status: 'pending', waiting: 'Waiting for design approval', due: '2026-12-15', owner: 'Joy', pay: 'partial' },
    { id: 'p7', customerId: 'c7', garment: 'Staff polo shirt', pieces: 10, price: 5500, status: 'pending', waiting: 'Waiting for down payment', due: '2026-12-01', owner: 'Ana', pay: 'unpaid' },
    { id: 'p8', customerId: 'c1', garment: 'Basketball jersey (away)', pieces: 8, price: 6800, status: 'completed', due: '2026-06-02', owner: 'Joy', pay: 'paid', pickedUp: '2026-06-01', pickedBy: 'Coach Ray Dalisay', file: 'northside-tigers-away.svg' },
    { id: 'p9', customerId: 'c3', garment: 'PE uniform (kids)', pieces: 60, price: 21000, status: 'completed', due: '2026-08-21', owner: 'Ana', pay: 'paid', pickedUp: '2026-08-20', pickedBy: 'Ms. Clara Ramos', file: 'hillcrest-pe-kids.svg' },
    { id: 'p10', customerId: 'c4', garment: 'Basketball jersey', pieces: 60, price: 48000, status: 'completed', due: '2026-05-30', owner: 'Mark', pay: 'partial', pickedUp: '2026-05-30', pickedBy: 'Mr. Joel Santos', file: 'riverside-league-2026.svg' },
    { id: 'p11', customerId: 'c8', garment: 'Softball jersey', pieces: 15, price: 11250, status: 'ongoing', stage: 4, due: '2026-11-21', owner: 'Ana', pay: 'partial' },
  ];
  return { version: 1, sample: true, customers, orders, projects, charts: sampleCharts() };
}

export function emptyData() {
  return { version: 1, sample: false, customers: [], orders: [], projects: [], charts: sampleCharts() };
}
