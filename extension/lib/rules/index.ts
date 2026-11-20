import { db } from '../db';
import type { SiteRule } from '../types';

export function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Retrieves the matching SiteRule for a given domain or URL.
 */
export async function getRuleForDomain(domainOrUrl: string): Promise<SiteRule | undefined> {
  const domain = domainOrUrl.includes('://') ? extractDomainFromUrl(domainOrUrl) : domainOrUrl.toLowerCase();
  if (!domain) return undefined;

  // Direct match
  const exact = await db.siteRules.where('domain').equals(domain).first();
  if (exact) return exact;

  // Match without 'www.'
  const stripped = domain.replace(/^www\./, '');
  const matched = await db.siteRules.where('domain').equals(stripped).first();
  if (matched) return matched;

  // Subdomain match: e.g. "truyen.tangthuvien.vn" vs "tangthuvien.vn"
  const allRules = await db.siteRules.toArray();
  for (const rule of allRules) {
    if (domain.endsWith('.' + rule.domain) || rule.domain.endsWith('.' + domain)) {
      return rule;
    }
  }

  return undefined;
}

/**
 * Saves a new rule or updates an existing one.
 */
export async function saveSiteRule(
  rule: Omit<SiteRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }
): Promise<number> {
  const cleanRule = JSON.parse(JSON.stringify(rule));
  const now = Date.now();
  if (cleanRule.id) {
    await db.siteRules.update(cleanRule.id, {
      ...cleanRule,
      updatedAt: now
    });
    return cleanRule.id;
  }

  // Check if domain already exists
  const existing = await db.siteRules.where('domain').equals(cleanRule.domain.toLowerCase()).first();
  if (existing && existing.id) {
    await db.siteRules.update(existing.id, {
      ...cleanRule,
      updatedAt: now
    });
    return existing.id;
  }

  const id = await db.siteRules.add({
    ...cleanRule,
    domain: cleanRule.domain.toLowerCase(),
    createdAt: now,
    updatedAt: now
  } as SiteRule);

  return id as number;
}

/**
 * Deletes a custom rule by ID. Built-in presets are preserved.
 */
export async function deleteSiteRule(id: number): Promise<boolean> {
  const rule = await db.siteRules.get(id);
  if (!rule || rule.isPreset) {
    return false; // Do not delete presets
  }
  await db.siteRules.delete(id);
  return true;
}

/**
 * Exports all rules to a formatted JSON string.
 */
export async function exportRulesToJson(): Promise<string> {
  const rules = await db.siteRules.toArray();
  return JSON.stringify(rules, null, 2);
}

/**
 * Imports rules from a JSON string, validating required fields.
 */
export async function importRulesFromJson(jsonStr: string): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return { imported: 0, errors: ['Định dạng JSON không hợp lệ: phải là một danh sách các luật (Array).'] };
    }

    for (const item of parsed) {
      if (!item.domain || typeof item.domain !== 'string') {
        errors.push(`Bỏ qua mục thiếu tên miền (domain): ${JSON.stringify(item)}`);
        continue;
      }

      await saveSiteRule({
        domain: item.domain,
        name: item.name || item.domain,
        contentSelector: item.contentSelector || '',
        titleSelector: item.titleSelector || '',
        nextSelector: item.nextSelector || '',
        tocSelector: item.tocSelector || '',
        paginationSelector: item.paginationSelector || '',
        excludeSelectors: Array.isArray(item.excludeSelectors) ? item.excludeSelectors : [],
        isPreset: false
      });
      imported++;
    }
  } catch (err) {
    errors.push(`Lỗi khi đọc file JSON: ${(err as Error).message}`);
  }

  return { imported, errors };
}
