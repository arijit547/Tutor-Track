import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

/** Execute the real browser services with a synthetic SDK, never a live project. */
export function firebaseHarness() {
  const documents = new Map<string, any>();
  const values = new Map<string, string>();
  const storage = {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, String(value)); },
    removeItem(key: string) { values.delete(key); },
  };
  const auth = {
    currentUser: { uid: 'alice' } as { uid: string } | null,
    onAuthStateChanged(callback: () => void) { queueMicrotask(callback); return () => {}; },
  };
  const controls = {
    online: true, failWrites: false, failReads: false, failPaymentReads: false, cachedReads: false,
    beforeWrite: undefined as (() => Promise<void>) | undefined,
    beforeRead: undefined as (() => Promise<void>) | undefined,
    writeCount: 0, storageFails: false,
  };
  const sdk = {
    doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
    collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
    Timestamp: { now: () => ({ seconds: 123 }) },
    async setDoc(ref: string, data: unknown) {
      await controls.beforeWrite?.();
      if (controls.failWrites) throw new Error('Synthetic write failure');
      controls.writeCount++;
      documents.set(ref, JSON.parse(JSON.stringify(data)));
    },
    async updateDoc(ref: string, data: object) {
      await controls.beforeWrite?.();
      if (controls.failWrites || !documents.has(ref)) throw new Error('Synthetic update failure');
      controls.writeCount++;
      documents.set(ref, { ...documents.get(ref), ...data });
    },
    async deleteDoc(ref: string) {
      await controls.beforeWrite?.();
      if (controls.failWrites) throw new Error('Synthetic delete failure');
      controls.writeCount++;
      documents.delete(ref);
    },
    async getDocs(ref: string) {
      await controls.beforeRead?.();
      if (controls.failReads || (controls.failPaymentReads && ref.endsWith('/payments'))) throw new Error('Synthetic read failure');
      return { metadata: { fromCache: controls.cachedReads }, docs: [...documents.entries()]
        .filter(([key]) => key.startsWith(`${ref}/`) && !key.slice(ref.length + 1).includes('/'))
        .map(([key, data]) => ({ id: key.split('/').at(-1), data: () => data })) };
    },
  };
  const imports: Record<string, any> = { './firebase': { db: {}, auth, isFirebaseConfigured: () => true }, 'firebase/firestore': sdk };
  const browserStorage = {
    get length() { return storage.length; },
    key: storage.key, getItem: storage.getItem, removeItem: storage.removeItem,
    setItem(key: string, value: string) {
      if (controls.storageFails) throw new Error('Synthetic quota failure');
      storage.setItem(key, value);
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    localStorage: browserStorage, navigator: { get onLine() { return controls.online; } },
    crypto: { randomUUID }, queueMicrotask, setTimeout, clearTimeout,
  });
  function load(name: string) {
    const source = readFileSync(new URL(`../${name}.ts`, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} as any };
    const execute = vm.runInContext(`(function(require, module, exports) { ${js}\n})`, context);
    execute((id: string) => {
      if (!(id in imports)) throw new Error(`Unexpected service import: ${id}`);
      return imports[id];
    }, module, module.exports);
    return module.exports;
  }
  const { firebaseService } = load('firebaseService');
  imports['./firebaseService'] = { firebaseService };
  function appHandler(name: string, bindings: Record<string, unknown>) {
    Object.assign(context, bindings);
    const source = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let initializer = '';
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer!.getText(ast);
      ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!initializer) throw new Error(`Missing App handler: ${name}`);
    const compiled = ts.transpileModule(`const handler = ${initializer};`, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return vm.runInContext(`(function() { ${compiled}; return handler; })()`, context);
  }
  return { auth, documents, storage, controls, firebaseService, load, appHandler };
}

export const student = (id = 'student-1') => ({
  id, name: 'Synthetic student', subject: 'Math', scheduleDays: ['Mon'], scheduleTime: '17:00',
  ratePerSession: 100, active: true, joinedDate: '2026-11-18T00:00:00.000Z', sessions: [], payments: [],
});
export const payment = (id = 'payment-1') => ({ id, amount: 500, date: '2026-11-18T00:00:00.000Z' });
