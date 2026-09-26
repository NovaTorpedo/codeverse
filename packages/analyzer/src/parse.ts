import ts from 'typescript';
import type { RouteInfo, SymbolInfo } from '@codeverse/schema';

export interface ImportBinding {
  local: string;
  imported: string;
}

export interface ImportInfo {
  specifier: string;
  line: number;
  bindings: ImportBinding[];
  typeOnly: boolean;
}

export interface CallInfo {
  /** Local name of the imported binding that is invoked. */
  local: string;
  /** Member invoked on it, for namespace imports or typed instance properties. */
  member?: string;
  line: number;
  viaProperty?: boolean;
}

export interface ParsedFile {
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  calls: CallInfo[];
  routes: RouteInfo[];
  /** `this.<prop>` → type name, from constructor parameter properties and class fields. */
  typedProps: Map<string, string>;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all']);

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(m|c)?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

export function parseSource(fileName: string, text: string): ParsedFile {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const calls: CallInfo[] = [];
  const routes: RouteInfo[] = [];
  const typedProps = new Map<string, string>();

  const addSymbol = (name: string, kind: SymbolInfo['kind'], node: ts.Node, exported: boolean) =>
    symbols.push({ name, kind, line: lineOf(node.getStart(sf)), endLine: lineOf(node.getEnd()), exported });

  const typeName = (t: ts.TypeNode | undefined): string | undefined =>
    t && ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) ? t.typeName.text : undefined;

  for (const stmt of sf.statements) {
    const exported = isExported(stmt);
    if (ts.isFunctionDeclaration(stmt) && stmt.name) addSymbol(stmt.name.text, 'function', stmt, exported);
    else if (ts.isClassDeclaration(stmt) && stmt.name) {
      addSymbol(stmt.name.text, 'class', stmt, exported);
      for (const m of stmt.members) {
        if ((ts.isMethodDeclaration(m) || ts.isGetAccessor(m)) && m.name && ts.isIdentifier(m.name)) {
          addSymbol(`${stmt.name.text}.${m.name.text}`, 'method', m, exported);
        }
        if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) {
          const tn = typeName(m.type);
          if (tn) typedProps.set(m.name.text, tn);
        }
        if (ts.isConstructorDeclaration(m)) {
          for (const p of m.parameters) {
            const hasPropModifier = (ts.getModifiers(p) ?? []).some((mod) =>
              [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(mod.kind),
            );
            const tn = typeName(p.type);
            if (hasPropModifier && tn && ts.isIdentifier(p.name)) typedProps.set(p.name.text, tn);
          }
        }
      }
    } else if (ts.isInterfaceDeclaration(stmt)) addSymbol(stmt.name.text, 'interface', stmt, exported);
    else if (ts.isTypeAliasDeclaration(stmt)) addSymbol(stmt.name.text, 'type', stmt, exported);
    else if (ts.isEnumDeclaration(stmt)) addSymbol(stmt.name.text, 'enum', stmt, exported);
    else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const isFn = d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
        addSymbol(d.name.text, isFn ? 'function' : 'variable', d, exported);
      }
    } else if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const bindings: ImportBinding[] = [];
      const clause = stmt.importClause;
      if (clause?.name) bindings.push({ local: clause.name.text, imported: 'default' });
      const nb = clause?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) bindings.push({ local: nb.name.text, imported: '*' });
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) bindings.push({ local: el.name.text, imported: (el.propertyName ?? el.name).text });
      }
      imports.push({ specifier: stmt.moduleSpecifier.text, line: lineOf(stmt.getStart(sf)), bindings, typeOnly: Boolean(clause?.isTypeOnly) });
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      imports.push({ specifier: stmt.moduleSpecifier.text, line: lineOf(stmt.getStart(sf)), bindings: [], typeOnly: stmt.isTypeOnly });
    }
  }

  const paramTypes = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      const tn = typeName(node.type);
      if (tn) paramTypes.set(node.name.text, tn);
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = node.expression;
      const line = lineOf(node.getStart(sf));
      if (ts.isIdentifier(callee)) {
        if (callee.text === 'require' && ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          imports.push({ specifier: node.arguments[0].text, line, bindings: [], typeOnly: false });
        } else calls.push({ local: callee.text, line });
      } else if (ts.isPropertyAccessExpression(callee)) {
        const obj = callee.expression;
        const member = callee.name.text;
        if (ts.isIdentifier(obj)) {
          const tn = paramTypes.get(obj.text);
          calls.push(tn ? { local: tn, member, line, viaProperty: true } : { local: obj.text, member, line });
        }
        else if (ts.isPropertyAccessExpression(obj) && obj.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const tn = typedProps.get(obj.name.text);
          if (tn) calls.push({ local: tn, member, line, viaProperty: true });
        }
        const arg0 = ts.isCallExpression(node) ? node.arguments[0] : undefined;
        if (HTTP_METHODS.has(member) && arg0 && (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0)) && arg0.text.startsWith('/')) {
          const arg1 = ts.isCallExpression(node) ? node.arguments[1] : undefined;
          routes.push({ method: member.toUpperCase(), path: arg0.text, line, handler: arg1 && ts.isIdentifier(arg1) ? arg1.text : undefined });
        }
      }
      if (ts.isCallExpression(node) && callee.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        imports.push({ specifier: node.arguments[0].text, line, bindings: [{ local: '*dynamic*', imported: '*' }], typeOnly: false });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { symbols, imports, calls, routes, typedProps };
}
