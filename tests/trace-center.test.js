import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const apiSource = fs.readFileSync(path.join(root, 'src/app/api/trace/route.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'src/app/trace/page.js'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(root, 'src/components/Dashboard.jsx'), 'utf8');
const layoutSource = fs.readFileSync(path.join(root, 'src/app/layout-client.jsx'), 'utf8');

describe('Trace Center', () => {
  it('reads existing sources without exposing mutation handlers', () => {
    expect(apiSource).toContain('TARGETED_TRACE_SEARCH');
    expect(apiSource).toContain('prisma.productionReport.findMany');
    expect(apiSource).toContain('prisma.ledger.findMany');
    expect(apiSource).toContain('prisma.cashSale.findMany');
    expect(apiSource).toContain('prisma.auditLog.findMany');
    expect(apiSource).not.toMatch(/prisma\.[A-Za-z]+\.(create|update|delete)/);
  });

  it('preserves source ids and sale item cap breakdowns for tracing', () => {
    expect(apiSource).toContain('sourceId: row.id');
    expect(apiSource).toContain('saleItems: row.saleItems');
    expect(pageSource).toContain('item.capBreakdown');
    expect(pageSource).toContain('Source ID');
  });

  it('exposes the page from the shared header and Dashboard menu', () => {
    expect(layoutSource).toContain("'/trace': 'Trace / Lineage Center'");
    expect(dashboardSource).toContain('href="/trace"');
  });
});
