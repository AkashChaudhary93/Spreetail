import { SettlementTransaction, UserBalance } from './settlements';

// Client-Side Database Entities (Mirroring original Prisma Schemas)
export interface ClientUser {
  id: string;
  name: string;
  email: string | null;
}

export interface ClientGroup {
  id: string;
  name: string;
  baseCurrency: string;
}

export interface ClientGroupMembership {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  user: ClientUser;
}

export interface ClientExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
  splitValue: number | null;
  user: ClientUser;
}

export interface ClientExpense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  dateIncurred: string;
  paidById: string;
  splitType: string;
  notes: string | null;
  isSettlement: boolean;
  createdAt: string;
  paidBy: ClientUser;
  splits: ClientExpenseSplit[];
}

export interface ClientStagedExpense {
  id: string;
  groupId: string;
  rawRowData: string; // JSON string of CSV row
  dateRaw: string;
  description: string;
  paidByRaw: string;
  amountRaw: string;
  currencyRaw: string | null;
  splitTypeRaw: string | null;
  splitWithRaw: string | null;
  splitDetailsRaw: string | null;
  notesRaw: string | null;
  anomalies: string[]; // parsed array
  anomalyDetails: any; // parsed object
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  resolvedExpenseId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ClientAppState {
  group: ClientGroup;
  users: ClientUser[];
  memberships: ClientGroupMembership[];
  expenses: ClientExpense[];
  stagedExpenses: ClientStagedExpense[];
}

const GROUP_ID = 'flatmates-group-id';

// Default Seed Data
const DEFAULT_GROUP: ClientGroup = {
  id: GROUP_ID,
  name: 'Flatmates',
  baseCurrency: 'INR',
};

const DEFAULT_USERS: ClientUser[] = [
  { id: 'usr-aisha', name: 'Aisha', email: 'aisha@flatmates.com' },
  { id: 'usr-rohan', name: 'Rohan', email: 'rohan@flatmates.com' },
  { id: 'usr-priya', name: 'Priya', email: 'priya@flatmates.com' },
  { id: 'usr-meera', name: 'Meera', email: 'meera@flatmates.com' },
  { id: 'usr-sam', name: 'Sam', email: 'sam@flatmates.com' },
  { id: 'usr-dev', name: 'Dev', email: 'dev@visitor.com' },
  { id: 'usr-kabir', name: 'Kabir', email: 'kabir@visitor.com' },
];

const DEFAULT_MEMBERSHIPS = (): ClientGroupMembership[] => [
  {
    id: 'mem-aisha',
    groupId: GROUP_ID,
    userId: 'usr-aisha',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leftAt: null,
    user: DEFAULT_USERS[0],
  },
  {
    id: 'mem-rohan',
    groupId: GROUP_ID,
    userId: 'usr-rohan',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leftAt: null,
    user: DEFAULT_USERS[1],
  },
  {
    id: 'mem-priya',
    groupId: GROUP_ID,
    userId: 'usr-priya',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leftAt: null,
    user: DEFAULT_USERS[2],
  },
  {
    id: 'mem-meera',
    groupId: GROUP_ID,
    userId: 'usr-meera',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leftAt: '2026-03-31T23:59:59.000Z',
    user: DEFAULT_USERS[3],
  },
  {
    id: 'mem-sam',
    groupId: GROUP_ID,
    userId: 'usr-sam',
    joinedAt: '2026-04-15T00:00:00.000Z',
    leftAt: null,
    user: DEFAULT_USERS[4],
  },
  {
    id: 'mem-dev',
    groupId: GROUP_ID,
    userId: 'usr-dev',
    joinedAt: '2026-02-01T00:00:00.000Z',
    leftAt: '2026-03-15T23:59:59.000Z',
    user: DEFAULT_USERS[5],
  },
  {
    id: 'mem-kabir',
    groupId: GROUP_ID,
    userId: 'usr-kabir',
    joinedAt: '2026-03-11T00:00:00.000Z',
    leftAt: '2026-03-11T23:59:59.000Z',
    user: DEFAULT_USERS[6],
  },
];

// Helper: Generate UUID lookalikes client-side
function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// ----------------------------------------------------
// STORAGE LIFECYCLE
// ----------------------------------------------------
const STORAGE_KEY = 'spreetail_client_db';

export function getClientState(): ClientAppState {
  if (typeof window === 'undefined') {
    return {
      group: DEFAULT_GROUP,
      users: DEFAULT_USERS,
      memberships: DEFAULT_MEMBERSHIPS(),
      expenses: [],
      stagedExpenses: [],
    };
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const initialState: ClientAppState = {
      group: DEFAULT_GROUP,
      users: DEFAULT_USERS,
      memberships: DEFAULT_MEMBERSHIPS(),
      expenses: [],
      stagedExpenses: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse client store, resetting...', e);
    const initialState: ClientAppState = {
      group: DEFAULT_GROUP,
      users: DEFAULT_USERS,
      memberships: DEFAULT_MEMBERSHIPS(),
      expenses: [],
      stagedExpenses: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
    return initialState;
  }
}

export function saveClientState(state: ClientAppState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

// ----------------------------------------------------
// ACTIONS
// ----------------------------------------------------

export function resetDatabase(): ClientAppState {
  const state: ClientAppState = {
    group: DEFAULT_GROUP,
    users: DEFAULT_USERS,
    memberships: DEFAULT_MEMBERSHIPS(),
    expenses: [],
    stagedExpenses: [],
  };
  saveClientState(state);
  return state;
}

export function getMemberships(): ClientGroupMembership[] {
  return getClientState().memberships;
}

export function updateMembershipDates(
  membershipId: string,
  joinedAtStr: string,
  leftAtStr: string | null
): ClientAppState {
  const state = getClientState();
  const index = state.memberships.findIndex((m) => m.id === membershipId);
  if (index !== -1) {
    state.memberships[index].joinedAt = new Date(joinedAtStr).toISOString();
    state.memberships[index].leftAt = leftAtStr ? new Date(leftAtStr).toISOString() : null;
    saveClientState(state);
  }
  return state;
}

export function deleteExpense(expenseId: string): ClientAppState {
  const state = getClientState();

  // If this expense is resolved from a staged expense, reset staging status
  const stagedIndex = state.stagedExpenses.findIndex(
    (s) => s.resolvedExpenseId === expenseId
  );
  if (stagedIndex !== -1) {
    state.stagedExpenses[stagedIndex].status = 'PENDING';
    state.stagedExpenses[stagedIndex].resolvedExpenseId = null;
    state.stagedExpenses[stagedIndex].resolvedAt = null;
  }

  state.expenses = state.expenses.filter((e) => e.id !== expenseId);
  saveClientState(state);
  return state;
}

export function clearStaging(): ClientAppState {
  const state = getClientState();
  state.stagedExpenses = state.stagedExpenses.filter(
    (s) => s.status !== 'PENDING' && s.status !== 'REJECTED'
  );
  saveClientState(state);
  return state;
}

export function executeSettlement(
  fromName: string,
  toName: string,
  amount: number,
  currency: string
): ClientAppState {
  const state = getClientState();
  const fromUser = state.users.find((u) => u.name === fromName);
  const toUser = state.users.find((u) => u.name === toName);

  if (!fromUser || !toUser) {
    throw new Error('Users not found');
  }

  const expenseId = generateId('exp');
  const rate = currency.toUpperCase() === 'USD' ? 83.5 : 1.0;

  const expense: ClientExpense = {
    id: expenseId,
    groupId: GROUP_ID,
    description: `Settlement: ${fromName} paid ${toName}`,
    amount,
    currency,
    exchangeRate: rate,
    dateIncurred: new Date().toISOString(),
    paidById: fromUser.id,
    splitType: 'EQUAL',
    notes: 'Direct Cash Settlement',
    isSettlement: true,
    createdAt: new Date().toISOString(),
    paidBy: fromUser,
    splits: [],
  };

  const split: ClientExpenseSplit = {
    id: generateId('split'),
    expenseId,
    userId: toUser.id,
    amount,
    splitValue: amount,
    user: toUser,
  };

  expense.splits.push(split);
  state.expenses.unshift(expense);

  saveClientState(state);
  return state;
}

// ----------------------------------------------------
// CSV PARSING & ANOMALY DETECTOR ENGINE
// ----------------------------------------------------

export interface ParsedCSVRow {
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(csvContent: string): ParsedCSVRow[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push({
      date: row.date || '',
      description: row.description || '',
      paid_by: row.paid_by || '',
      amount: row.amount || '',
      currency: row.currency || '',
      split_type: row.split_type || '',
      split_with: row.split_with || '',
      split_details: row.split_details || '',
      notes: row.notes || '',
    });
  }

  return rows;
}

export function resolveUserName(rawName: string, dbUsers: string[]): string | null {
  const clean = rawName.trim().toLowerCase();
  if (!clean) return null;

  const match = dbUsers.find((u) => u.toLowerCase() === clean);
  if (match) return match;

  const prefixMatch = dbUsers.find(
    (u) => clean.startsWith(u.toLowerCase()) || u.toLowerCase().startsWith(clean)
  );
  if (prefixMatch) return prefixMatch;

  return null;
}

export function parseCSVDate(dateStr: string): {
  date: Date | null;
  isAmbiguous: boolean;
  isInvalid: boolean;
} {
  const clean = dateStr.trim();
  if (!clean) return { date: null, isAmbiguous: false, isInvalid: true };

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(clean + 'T00:00:00Z');
    return { date: isNaN(d.getTime()) ? null : d, isAmbiguous: false, isInvalid: isNaN(d.getTime()) };
  }

  // DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const parts = clean.split('/');
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (p1 <= 12 && p2 <= 12) {
      const d = new Date(Date.UTC(year, p2 - 1, p1));
      return { date: d, isAmbiguous: true, isInvalid: false };
    }

    if (p1 > 12 && p2 <= 12) {
      const d = new Date(Date.UTC(year, p2 - 1, p1));
      return { date: d, isAmbiguous: false, isInvalid: false };
    }

    if (p2 > 12 && p1 <= 12) {
      const d = new Date(Date.UTC(year, p1 - 1, p2));
      return { date: d, isAmbiguous: false, isInvalid: false };
    }

    return { date: null, isAmbiguous: false, isInvalid: true };
  }

  // "Mar 14", "Feb 8"
  const monthMatch = clean.match(/^([a-zA-Z]+)\s+(\d{1,2})$/);
  if (monthMatch) {
    const monthStr = monthMatch[1].toLowerCase().slice(0, 3);
    const day = parseInt(monthMatch[2], 10);
    const months: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    if (months[monthStr] !== undefined) {
      const d = new Date(Date.UTC(2026, months[monthStr], day));
      return { date: d, isAmbiguous: false, isInvalid: false };
    }
  }

  const fallbackDate = new Date(clean);
  const isInvalid = isNaN(fallbackDate.getTime());
  return { date: isInvalid ? null : fallbackDate, isAmbiguous: false, isInvalid };
}

// Embedded raw CSV Content from expenses_export.csv
export const EMBEDDED_CSV_CONTENT = `date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
2026-02-01,February rent,Aisha,48000,INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-03,Groceries BigBasket,Priya,2340,INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-05,Wifi bill Feb,Rohan,1199,INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-08,Dinner at Marina Bites,Dev,3200,INR,equal,"Aisha;Rohan;Priya;Dev",,Dev visiting for the weekend
2026-02-08,dinner - marina bites,Dev,3200,INR,equal,"Aisha;Rohan;Priya;Dev",,
2026-02-10,Electricity Feb,Aisha,"1,200",INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-12,Maid salary Feb,Meera,3000,INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-14,Movie night snacks,priya,640,INR,equal,"Aisha;Rohan;Priya",,Meera skipped
2026-02-15,Cylinder refill,Rohan,899.995,INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-18,Groceries DMart,Priya S,1875,INR,equal,"Aisha;Rohan;Priya;Meera",,
2026-02-20,Aisha birthday cake,Rohan,1500,INR,unequal,"Rohan;Priya;Meera","Rohan 700; Priya 400; Meera 400",Aisha not charged obviously
2026-02-22,House cleaning supplies,,780,INR,equal,"Aisha;Rohan;Priya;Meera",,can't remember who paid
2026-02-25,Rohan paid Aisha back,Rohan,5000,INR,,Aisha,,this is a settlement not an expense??
2026-02-28,Pizza Friday,Aisha,1440,INR,percentage,"Aisha;Rohan;Priya;Meera","Aisha 30%; Rohan 30%; Priya 30%; Meera 20%",percentages might be off
01/03/2026,March rent,Aisha,48000,INR,equal,"Aisha;Rohan;Priya;Meera",,
03/03/2026,Groceries BigBasket,Meera,2810,INR,equal,"Aisha;Rohan;Priya;Meera",,
05/03/2026,Wifi bill Mar,Rohan,1199,INR,equal,"Aisha;Rohan;Priya;Meera",,
08/03/2026,Goa flights,Aisha,32400,INR,equal,"Aisha;Rohan;Priya;Dev",,trip starts!
09/03/2026,Goa villa booking,Dev,540,USD,equal,"Aisha;Rohan;Priya;Dev",,booked on intl site
10/03/2026,Beach shack lunch,Rohan,84,USD,equal,"Aisha;Rohan;Priya;Dev",,
10/03/2026,Scooter rentals,Priya,3600,INR,share,"Aisha;Rohan;Priya;Dev","Aisha 1; Rohan 2; Priya 1; Dev 2",Rohan and Dev took the bigger ones
11/03/2026,Parasailing,Dev,150,USD,equal,"Aisha;Rohan;Priya;Dev;Dev's friend Kabir",,Kabir joined for the day
11/03/2026,Dinner at Thalassa,Aisha,2400,INR,equal,"Aisha;Rohan;Priya;Dev",,
11/03/2026,Thalassa dinner,Rohan,2450,INR,equal,"Aisha;Rohan;Priya;Dev",,Aisha also logged this I think hers is wrong
12/03/2026,Parasailing refund,Dev,-30,USD,equal,"Aisha;Rohan;Priya;Dev",,one slot got cancelled
Mar 14,Airport cab,rohan ,1100,INR,equal,"Aisha;Rohan;Priya;Dev",,
15/03/2026,Groceries DMart,Priya,2105,,equal,"Aisha;Rohan;Priya;Meera",,forgot to set currency
18/03/2026,Electricity Mar,Aisha, 1450 ,INR,equal,"Aisha;Rohan;Priya;Meera",,
20/03/2026,Maid salary Mar,Meera,3000,INR,equal,"Aisha;Rohan;Priya;Meera",,
22/03/2026,Dinner order Swiggy,Priya,0,INR,equal,"Aisha;Rohan;Priya;Meera",,counted twice earlier - fixing later
25/03/2026,Weekend brunch,Meera,2200,INR,percentage,"Aisha;Rohan;Priya;Meera","Aisha 30%; Rohan 30%; Priya 30%; Meera 20%",
28/03/2026,Meera farewell dinner,Aisha,4800,INR,equal,"Aisha;Rohan;Priya;Meera",,Meera moving out Sunday :(
04/05/2026,Deep cleaning service,Rohan,2500,INR,equal,"Aisha;Rohan;Priya",,is this April 5 or May 4? format is a mess
2026-04-01,April rent,Aisha,48000,INR,share,"Aisha;Rohan;Priya","Aisha 2; Rohan 1; Priya 1",Aisha took Meera's room too
2026-04-02,Groceries BigBasket,Priya,2640,INR,equal,"Aisha;Rohan;Priya;Meera",,oops Meera still in the group list
2026-04-05,Wifi bill Apr,Rohan,1199,INR,equal,"Aisha;Rohan;Priya",,
2026-04-08,Sam deposit share,Sam,15000,INR,equal,Aisha,,Sam moving in! paid Aisha his deposit
2026-04-10,Housewarming drinks,Sam,3100,INR,equal,"Aisha;Rohan;Priya;Sam",,
2026-04-12,Electricity Apr,Aisha,1380,INR,equal,"Aisha;Rohan;Priya;Sam",,
2026-04-15,Groceries DMart,Sam,1990,INR,equal,"Aisha;Rohan;Priya;Sam",,
2026-04-18,Furniture for common room,Aisha,12000,INR,equal,"Aisha;Rohan;Priya;Sam","Aisha 1; Rohan 1; Priya 1; Sam 1",split_type says equal but someone added shares anyway
2026-04-20,Maid salary Apr,Priya,3000,INR,equal,"Aisha;Rohan;Priya;Sam",,`;

export function readOriginalCSVFile(): string {
  return EMBEDDED_CSV_CONTENT;
}


export function detectAnomalies(
  row: ParsedCSVRow,
  users: ClientUser[],
  memberships: ClientGroupMembership[],
  existingExpenses: ClientExpense[]
) {
  const anomalies: string[] = [];
  const details: any = {};
  const dbUserNames = users.map((u) => u.name);

  // Payer
  let resolvedPayer = resolveUserName(row.paid_by, dbUserNames);
  if (!row.paid_by.trim()) {
    anomalies.push('MISSING_PAYER');
    details.payer = 'The paid_by field is empty.';
  } else if (!resolvedPayer) {
    anomalies.push('UNKNOWN_USER');
    details.payer = `Payer "${row.paid_by}" does not exist in the database.`;
  } else if (resolvedPayer !== row.paid_by.trim()) {
    details.payer_auto_resolved = `Fuzzy matched "${row.paid_by}" to user "${resolvedPayer}".`;
  }

  // Amount
  const rawAmount = row.amount.replace(/"/g, '').trim();
  let numericAmount = parseFloat(rawAmount.replace(/,/g, ''));

  if (!rawAmount) {
    anomalies.push('INVALID_FORMAT');
    details.amount = 'Amount is missing.';
  } else if (isNaN(numericAmount)) {
    anomalies.push('INVALID_FORMAT');
    details.amount = `Amount "${row.amount}" could not be parsed as a number.`;
  } else {
    if (rawAmount.includes(',')) {
      details.amount_cleaned = `Cleaned formatted amount "${rawAmount}" to ${numericAmount}.`;
    }
    if (numericAmount < 0) {
      anomalies.push('NEGATIVE_AMOUNT');
      details.amount_refund = `Negative amount ${numericAmount} detected. Handled as a refund.`;
    }
    if (numericAmount === 0) {
      anomalies.push('ZERO_AMOUNT');
      details.amount = 'Amount is zero.';
    }
    const decimalParts = rawAmount.split('.');
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
      const rounded = Math.round(numericAmount * 100) / 100;
      details.amount_rounded = `Rounded amount ${numericAmount} to ${rounded} (2 decimals).`;
      numericAmount = rounded;
    }
  }

  // Date
  const dateResult = parseCSVDate(row.date);
  const parsedDate = dateResult.date;

  if (dateResult.isInvalid) {
    anomalies.push('INVALID_FORMAT');
    details.date = `Date "${row.date}" could not be parsed.`;
  } else if (dateResult.isAmbiguous) {
    anomalies.push('AMBIGUOUS_DATE');
    details.date = `Date "${row.date}" is ambiguous (could be DD/MM/YYYY or MM/DD/YYYY).`;
  }

  // Currency
  if (!row.currency.trim()) {
    anomalies.push('MISSING_CURRENCY');
    details.currency = 'Currency is missing. Defaulted to group base currency (INR).';
  }

  // Split-with list
  const splitWithList = row.split_with
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const resolvedSplitWith: string[] = [];
  const unknownSplitUsers: string[] = [];

  splitWithList.forEach((name) => {
    const res = resolveUserName(name, dbUserNames);
    if (res) {
      resolvedSplitWith.push(res);
    } else if (name) {
      unknownSplitUsers.push(name);
    }
  });

  if (unknownSplitUsers.length > 0) {
    anomalies.push('UNKNOWN_USER');
    details.split_with = `The following split members do not exist: ${unknownSplitUsers.join(
      ', '
    )}.`;
  }

  // Date-bound memberships
  if (parsedDate) {
    if (resolvedPayer) {
      const payerObj = users.find((u) => u.name === resolvedPayer);
      const membership = memberships.find((m) => m.userId === payerObj?.id);
      if (!membership) {
        anomalies.push('MEMBERSHIP_OUT_OF_BOUNDS');
        details.membership_payer = `${resolvedPayer} is not a member of this group.`;
      } else {
        const joined = new Date(membership.joinedAt);
        const left = membership.leftAt ? new Date(membership.leftAt) : null;
        if (parsedDate < joined || (left && parsedDate > left)) {
          anomalies.push('MEMBERSHIP_OUT_OF_BOUNDS');
          details.membership_payer = `Expense date ${parsedDate
            .toISOString()
            .slice(0, 10)} is outside ${resolvedPayer}'s membership range (Joined: ${joined
            .toISOString()
            .slice(
              0,
              10
            )}, Left: ${left ? left.toISOString().slice(0, 10) : 'Active'}).`;
        }
      }
    }

    const outOfBoundsMembers: string[] = [];
    resolvedSplitWith.forEach((memberName) => {
      const memberObj = users.find((u) => u.name === memberName);
      const membership = memberships.find((m) => m.userId === memberObj?.id);
      if (membership) {
        const joined = new Date(membership.joinedAt);
        const left = membership.leftAt ? new Date(membership.leftAt) : null;
        if (parsedDate! < joined || (left && parsedDate! > left)) {
          outOfBoundsMembers.push(memberName);
        }
      } else {
        outOfBoundsMembers.push(memberName);
      }
    });

    if (outOfBoundsMembers.length > 0) {
      anomalies.push('MEMBERSHIP_OUT_OF_BOUNDS');
      details.membership_split = `The following split members were not active in the group on the expense date: ${outOfBoundsMembers.join(
        ', '
      )}.`;
    }
  }

  // Settlement detection
  const descLower = row.description.toLowerCase();
  const notesLower = row.notes.toLowerCase();
  const isSettlementKeyword =
    (descLower.includes('paid') && descLower.includes('back')) ||
    descLower.includes('settle') ||
    notesLower.includes('settlement');
  const hasSingleSplitReceiver =
    resolvedSplitWith.length === 1 && resolvedSplitWith[0] !== resolvedPayer;

  if (isSettlementKeyword || (hasSingleSplitReceiver && !row.split_type)) {
    anomalies.push('SETTLEMENT_LOGGED_AS_EXPENSE');
    details.settlement = `This transaction appears to be a direct settlement payment rather than a shared group expense.`;
  }

  // Split calculations validator
  if (row.split_type.toLowerCase() === 'percentage' && row.split_details) {
    const parts = row.split_details.split(';').map((p) => p.trim());
    let totalPct = 0;
    parts.forEach((part) => {
      const match = part.match(/(.+)\s+(\d+)\s*%/);
      if (match) {
        totalPct += parseInt(match[2], 10);
      }
    });

    if (totalPct !== 100) {
      anomalies.push('INVALID_SPLIT_DETAILS');
      details.split_details = `Percentage splits sum to ${totalPct}%, but must equal 100%.`;
    }
  }

  // Duplicate Check
  if (parsedDate && resolvedPayer && !isNaN(numericAmount)) {
    const startOfParsedDate = new Date(parsedDate);
    startOfParsedDate.setUTCHours(0, 0, 0, 0);

    const dup = existingExpenses.find((e) => {
      const d = new Date(e.dateIncurred);
      d.setUTCHours(0, 0, 0, 0);
      return (
        d.getTime() === startOfParsedDate.getTime() &&
        e.paidBy.name === resolvedPayer &&
        e.amount === numericAmount &&
        e.description.toLowerCase().includes(row.description.toLowerCase().slice(0, 10))
      );
    });

    if (dup) {
      anomalies.push('DUPLICATE');
      details.duplicate = `Possible duplicate of existing expense "${dup.description}" (ID: ${dup.id}).`;
    }
  }

  return {
    anomalies,
    details,
    resolvedValues: {
      payer: resolvedPayer,
      amount: numericAmount,
      date: parsedDate ? parsedDate.toISOString() : null,
      splitWith: resolvedSplitWith,
    },
  };
}

export function importCSVData(csvContent: string): ClientAppState {
  const state = getClientState();
  const parsedRows = parseCSV(csvContent);

  const newStaged: ClientStagedExpense[] = [];
  const addedExpenses: ClientExpense[] = [];

  for (const row of parsedRows) {
    const detection = detectAnomalies(row, state.users, state.memberships, [
      ...state.expenses,
      ...addedExpenses,
    ]);

    // Self-duplicate check inside the file
    const startOfRowDate = detection.resolvedValues.date
      ? new Date(detection.resolvedValues.date)
      : null;
    if (startOfRowDate) {
      startOfRowDate.setUTCHours(0, 0, 0, 0);
      const isDuplicateInFile = newStaged.some((s) => {
        if (s.anomalies.includes('DUPLICATE')) return false;
        const d = s.dateRaw ? parseCSVDate(s.dateRaw).date : null;
        if (d) d.setUTCHours(0, 0, 0, 0);
        return (
          d &&
          d.getTime() === startOfRowDate.getTime() &&
          s.paidByRaw.trim() === row.paid_by.trim() &&
          s.amountRaw.trim() === row.amount.trim() &&
          s.description.toLowerCase().includes(row.description.toLowerCase().slice(0, 10))
        );
      });

      if (isDuplicateInFile) {
        if (!detection.anomalies.includes('DUPLICATE')) {
          detection.anomalies.push('DUPLICATE');
          detection.details.duplicate_file =
            'Possible duplicate of another row in this CSV file import.';
        }
      }
    }

    const blockingAnomalies = [
      'DUPLICATE',
      'MISSING_PAYER',
      'UNKNOWN_USER',
      'MEMBERSHIP_OUT_OF_BOUNDS',
      'INVALID_SPLIT_DETAILS',
      'AMBIGUOUS_DATE',
      'INVALID_FORMAT',
      'ZERO_AMOUNT',
    ];
    const hasBlocking = detection.anomalies.some((a) => blockingAnomalies.includes(a));
    const status = hasBlocking ? 'PENDING' : 'APPROVED';

    const stagedId = generateId('stg');
    const staged: ClientStagedExpense = {
      id: stagedId,
      groupId: GROUP_ID,
      rawRowData: JSON.stringify(row),
      dateRaw: row.date,
      description: row.description,
      paidByRaw: row.paid_by,
      amountRaw: row.amount,
      currencyRaw: row.currency || null,
      splitTypeRaw: row.split_type || null,
      splitWithRaw: row.split_with || null,
      splitDetailsRaw: row.split_details || null,
      notesRaw: row.notes || null,
      anomalies: detection.anomalies,
      anomalyDetails: detection.details,
      status,
      resolvedExpenseId: null,
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };

    newStaged.push(staged);

    if (status === 'APPROVED' && detection.resolvedValues.date && detection.resolvedValues.payer) {
      const exp = convertStagedToExpenseLogic(staged, detection.resolvedValues, state.users);
      if (exp) {
        staged.status = 'APPROVED';
        staged.resolvedExpenseId = exp.id;
        staged.resolvedAt = new Date().toISOString();
        addedExpenses.push(exp);
      }
    }
  }

  state.stagedExpenses = [...newStaged, ...state.stagedExpenses];
  state.expenses = [...addedExpenses, ...state.expenses];

  saveClientState(state);
  return state;
}

function convertStagedToExpenseLogic(
  staged: ClientStagedExpense,
  resolvedValues: any,
  users: ClientUser[]
): ClientExpense | null {
  const payerUser = users.find((u) => u.name === resolvedValues.payer);
  if (!payerUser) return null;

  const rawRow: ParsedCSVRow = JSON.parse(staged.rawRowData);
  const splitType = rawRow.split_type ? rawRow.split_type.toUpperCase() : 'EQUAL';
  const isSettlement =
    staged.anomalies.includes('SETTLEMENT_LOGGED_AS_EXPENSE') ||
    (splitType === 'EQUAL' &&
      resolvedValues.splitWith.length === 1 &&
      resolvedValues.splitWith[0] !== resolvedValues.payer &&
      !rawRow.split_type);

  const expenseId = generateId('exp');
  const expense: ClientExpense = {
    id: expenseId,
    groupId: staged.groupId,
    description: staged.description,
    amount: resolvedValues.amount,
    currency: staged.currencyRaw || 'INR',
    exchangeRate: staged.currencyRaw?.toUpperCase() === 'USD' ? 83.5 : 1.0,
    dateIncurred: resolvedValues.date,
    paidById: payerUser.id,
    splitType: isSettlement ? 'EQUAL' : splitType,
    notes: rawRow.notes || null,
    isSettlement,
    createdAt: staged.createdAt,
    paidBy: payerUser,
    splits: [],
  };

  const splitMembers =
    resolvedValues.splitWith.length > 0 ? resolvedValues.splitWith : [resolvedValues.payer];
  const totalAmount = resolvedValues.amount;

  if (isSettlement) {
    const receiverName = splitMembers[0];
    const receiverUser = users.find((u) => u.name === receiverName);
    if (receiverUser) {
      expense.splits.push({
        id: generateId('split'),
        expenseId,
        userId: receiverUser.id,
        amount: totalAmount,
        splitValue: totalAmount,
        user: receiverUser,
      });
    }
  } else if (splitType === 'EQUAL') {
    const share = totalAmount / splitMembers.length;
    splitMembers.forEach((name: string) => {
      const user = users.find((u) => u.name === name);
      if (user) {
        expense.splits.push({
          id: generateId('split'),
          expenseId,
          userId: user.id,
          amount: share,
          splitValue: null,
          user,
        });
      }
    });
  } else if (splitType === 'PERCENTAGE' && rawRow.split_details) {
    const parts = rawRow.split_details.split(';').map((p) => p.trim());
    parts.forEach((part) => {
      const match = part.match(/(.+)\s+(\d+)\s*%/);
      if (match) {
        const name = resolveUserName(
          match[1],
          users.map((u) => u.name)
        );
        const pct = parseInt(match[2], 10);
        const user = users.find((u) => u.name === name);
        if (user) {
          expense.splits.push({
            id: generateId('split'),
            expenseId,
            userId: user.id,
            amount: (totalAmount * pct) / 100,
            splitValue: pct,
            user,
          });
        }
      }
    });
  } else if (splitType === 'SHARE' && rawRow.split_details) {
    const parts = rawRow.split_details.split(';').map((p) => p.trim());
    let totalShares = 0;
    const parsedShares: { name: string; shares: number }[] = [];

    parts.forEach((part) => {
      const match = part.match(/(.+)\s+(\d+)/);
      if (match) {
        const name = resolveUserName(
          match[1],
          users.map((u) => u.name)
        );
        const shares = parseInt(match[2], 10);
        if (name) {
          parsedShares.push({ name, shares });
          totalShares += shares;
        }
      }
    });

    parsedShares.forEach((item) => {
      const user = users.find((u) => u.name === item.name);
      if (user) {
        expense.splits.push({
          id: generateId('split'),
          expenseId,
          userId: user.id,
          amount: (totalAmount * item.shares) / totalShares,
          splitValue: item.shares,
          user,
        });
      }
    });
  } else if (splitType === 'UNEQUAL' && rawRow.split_details) {
    const parts = rawRow.split_details.split(';').map((p) => p.trim());
    parts.forEach((part) => {
      const match = part.match(/(.+)\s+(\d+(?:\.\d+)?)/);
      if (match) {
        const name = resolveUserName(
          match[1],
          users.map((u) => u.name)
        );
        const owedAmt = parseFloat(match[2]);
        const user = users.find((u) => u.name === name);
        if (user) {
          expense.splits.push({
            id: generateId('split'),
            expenseId,
            userId: user.id,
            amount: owedAmt,
            splitValue: owedAmt,
            user,
          });
        }
      }
    });
  }

  return expense;
}

export function resolveStagedExpense(
  stagedId: string,
  action: 'APPROVE' | 'REJECT',
  data?: {
    date: string;
    description: string;
    paid_by: string;
    amount: number;
    currency: string;
    split_type: string;
    split_with: string[];
    split_details?: string;
  }
): ClientAppState {
  const state = getClientState();
  const stagedIndex = state.stagedExpenses.findIndex((s) => s.id === stagedId);
  if (stagedIndex === -1) {
    throw new Error('Staged expense not found.');
  }

  const staged = state.stagedExpenses[stagedIndex];

  if (action === 'REJECT') {
    staged.status = 'REJECTED';
    saveClientState(state);
    return state;
  }

  if (!data) throw new Error('Data required for approval');

  const parsedDate = new Date(data.date);
  if (isNaN(parsedDate.getTime())) throw new Error('Invalid date format.');

  const dbUserNames = state.users.map((u) => u.name);
  const resolvedPayer = resolveUserName(data.paid_by, dbUserNames);
  if (!resolvedPayer) throw new Error(`Payer "${data.paid_by}" not found in database.`);

  const resolvedSplitWith: string[] = [];
  for (const name of data.split_with) {
    const res = resolveUserName(name, dbUserNames);
    if (!res) throw new Error(`Split member "${name}" not found in database.`);
    resolvedSplitWith.push(res);
  }

  // Validate dates bounds
  const payerObj = state.users.find((u) => u.name === resolvedPayer);
  const payerMem = state.memberships.find((m) => m.userId === payerObj?.id);
  if (!payerMem) throw new Error(`Payer "${resolvedPayer}" is not a group member.`);
  const pJoined = new Date(payerMem.joinedAt);
  const pLeft = payerMem.leftAt ? new Date(payerMem.leftAt) : null;
  if (parsedDate < pJoined || (pLeft && parsedDate > pLeft)) {
    throw new Error(`Expense date is outside "${resolvedPayer}"'s membership range.`);
  }

  for (const name of resolvedSplitWith) {
    const uObj = state.users.find((u) => u.name === name);
    const uMem = state.memberships.find((m) => m.userId === uObj?.id);
    if (!uMem) throw new Error(`Member "${name}" is not in the group.`);
    const uJoined = new Date(uMem.joinedAt);
    const uLeft = uMem.leftAt ? new Date(uMem.leftAt) : null;
    if (parsedDate < uJoined || (uLeft && parsedDate > uLeft)) {
      throw new Error(`Expense date is outside "${name}"'s membership range.`);
    }
  }

  // Update staged object in state
  const simulatedRow = {
    date: data.date,
    description: data.description,
    paid_by: resolvedPayer,
    amount: String(data.amount),
    currency: data.currency,
    split_type: data.split_type,
    split_with: resolvedSplitWith.join(';'),
    split_details: data.split_details || '',
    notes: 'Edited & Approved via Dashboard',
  };

  staged.rawRowData = JSON.stringify(simulatedRow);
  staged.description = data.description;
  staged.paidByRaw = resolvedPayer;
  staged.amountRaw = String(data.amount);
  staged.currencyRaw = data.currency;
  staged.splitTypeRaw = data.split_type;
  staged.splitWithRaw = resolvedSplitWith.join(';');
  staged.splitDetailsRaw = data.split_details || '';

  const detection = detectAnomalies(simulatedRow, state.users, state.memberships, state.expenses);

  const exp = convertStagedToExpenseLogic(staged, detection.resolvedValues, state.users);
  if (exp) {
    staged.status = 'APPROVED';
    staged.resolvedExpenseId = exp.id;
    staged.resolvedAt = new Date().toISOString();
    state.expenses.unshift(exp);
  }

  saveClientState(state);
  return state;
}
