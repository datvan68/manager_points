import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

export type RestoreTypeRuleSource = 'schema' | 'override' | 'manual';

export interface RestoreTypeRule {
  source: RestoreTypeRuleSource;
  objectIds?: string[];
  objectIdArrays?: string[];
  dates?: string[];
  embedded?: Record<string, RestoreTypeRule>;
  embeddedArrays?: Record<string, RestoreTypeRule>;
}

@Injectable()
export class RestoreTypeRegistry implements OnModuleInit {
  private readonly logger = new Logger(RestoreTypeRegistry.name);
  private rules = new Map<string, RestoreTypeRule>();

  constructor(@InjectConnection() private connection: Connection) {}

  onModuleInit() {
    this.buildSchemaRules();
    this.applyOverrideRules();
  }

  private buildSchemaRules() {
    const modelNames = this.connection.modelNames();
    for (const modelName of modelNames) {
      const model = this.connection.model(modelName);
      const collectionName = model.collection.collectionName;

      const rule = this.parseSchemaToRule(model.schema, 'schema');
      this.rules.set(collectionName, rule);
    }
  }

  private parseSchemaToRule(
    schema: any,
    source: RestoreTypeRuleSource,
  ): RestoreTypeRule {
    const rule: RestoreTypeRule = {
      source,
      objectIds: [],
      objectIdArrays: [],
      dates: [],
      embedded: {},
      embeddedArrays: {},
    };

    if (!schema || !schema.paths) return rule;

    for (const [path, schemaType] of Object.entries(schema.paths)) {
      const st = schemaType as any;

      // Mongoose flattens nested paths like 'details.0.criterion_id' in some cases,
      // but for proper schemas they are just 'details' as Array.
      if (st.instance === 'ObjectID' || st.instance === 'ObjectId') {
        rule.objectIds!.push(path);
      } else if (st.instance === 'Date') {
        rule.dates!.push(path);
      } else if (st.instance === 'Array' || st.instance === 'DocumentArray') {
        const caster = st.caster;
        if (caster) {
          if (
            caster.instance === 'ObjectID' ||
            caster.instance === 'ObjectId'
          ) {
            rule.objectIdArrays!.push(path);
          } else if (caster.schema) {
            // It's an array of subdocuments
            rule.embeddedArrays![path] = this.parseSchemaToRule(
              caster.schema,
              source,
            );
          }
        }
      } else if (st.instance === 'Embedded') {
        if (st.schema) {
          rule.embedded![path] = this.parseSchemaToRule(st.schema, source);
        }
      }
    }

    // Clean up empty arrays/objects for smaller memory footprint
    if (rule.objectIds?.length === 0) delete rule.objectIds;
    if (rule.objectIdArrays?.length === 0) delete rule.objectIdArrays;
    if (rule.dates?.length === 0) delete rule.dates;
    if (Object.keys(rule.embedded || {}).length === 0) delete rule.embedded;
    if (Object.keys(rule.embeddedArrays || {}).length === 0)
      delete rule.embeddedArrays;

    return rule;
  }

  private applyOverrideRules() {
    // legacy collection fields which schema didn't catch due to string vs objectid, etc.
    const overrides: Record<string, Partial<RestoreTypeRule>> = {
      summarypoints: {
        embeddedArrays: {
          details: {
            source: 'override',
            objectIds: ['criterion_id', 'gv_reviewed_by', 'locked_by'],
            embeddedArrays: {
              log: {
                source: 'override',
                objectIds: ['updated_by'],
                dates: ['updated_at'],
              },
            },
          },
        },
      },
      system_requests: {
        embeddedArrays: {
          status_history: {
            source: 'override',
            objectIds: ['changed_by'],
            dates: ['changed_at'],
          },
        },
      },
    };

    for (const [collectionName, overrideRule] of Object.entries(overrides)) {
      const existingRule = this.rules.get(collectionName) || {
        source: 'override',
      };
      this.rules.set(
        collectionName,
        this.mergeRules(existingRule, overrideRule as RestoreTypeRule),
      );
    }
  }

  private mergeRules(
    base: RestoreTypeRule,
    override: RestoreTypeRule,
  ): RestoreTypeRule {
    const result: RestoreTypeRule = {
      ...base,
      source: override.source || base.source,
    };

    if (override.objectIds) {
      result.objectIds = Array.from(
        new Set([...(base.objectIds || []), ...override.objectIds]),
      );
    }
    if (override.objectIdArrays) {
      result.objectIdArrays = Array.from(
        new Set([...(base.objectIdArrays || []), ...override.objectIdArrays]),
      );
    }
    if (override.dates) {
      result.dates = Array.from(
        new Set([...(base.dates || []), ...override.dates]),
      );
    }

    if (override.embedded) {
      result.embedded = result.embedded || {};
      for (const [key, rule] of Object.entries(override.embedded)) {
        result.embedded[key] = this.mergeRules(
          result.embedded[key] || { source: 'override' },
          rule,
        );
      }
    }

    if (override.embeddedArrays) {
      result.embeddedArrays = result.embeddedArrays || {};
      for (const [key, rule] of Object.entries(override.embeddedArrays)) {
        result.embeddedArrays[key] = this.mergeRules(
          result.embeddedArrays[key] || { source: 'override' },
          rule,
        );
      }
    }

    return result;
  }

  public getRule(collectionName: string): RestoreTypeRule | undefined {
    return this.rules.get(collectionName);
  }

  public hasRule(collectionName: string): boolean {
    return this.rules.has(collectionName);
  }

  public normalizeDocument(
    collectionName: string,
    doc: Record<string, any>,
  ): Record<string, any> {
    const rule = this.rules.get(collectionName);
    if (!rule) return doc; // Unknown collection, handled upstream if needed

    return this.applyRuleToDoc(doc, rule, collectionName);
  }

  private applyRuleToDoc(
    doc: any,
    rule: RestoreTypeRule,
    pathContext: string,
  ): any {
    if (!doc || typeof doc !== 'object') return doc;

    const result = { ...doc };

    if (rule.objectIds) {
      for (const field of rule.objectIds) {
        if (result[field] !== undefined && result[field] !== null) {
          result[field] = this.tryCastObjectId(
            result[field],
            `${pathContext}.${field}`,
          );
        }
      }
    }

    if (rule.objectIdArrays) {
      for (const field of rule.objectIdArrays) {
        if (result[field] !== undefined && result[field] !== null) {
          if (Array.isArray(result[field])) {
            result[field] = result[field].map((item: any, i: number) =>
              this.tryCastObjectId(item, `${pathContext}.${field}[${i}]`),
            );
          }
        }
      }
    }

    if (rule.dates) {
      for (const field of rule.dates) {
        if (result[field] !== undefined && result[field] !== null) {
          result[field] = this.tryCastDate(result[field]);
        }
      }
    }

    if (rule.embedded) {
      for (const [field, subRule] of Object.entries(rule.embedded)) {
        if (
          result[field] !== undefined &&
          result[field] !== null &&
          typeof result[field] === 'object'
        ) {
          result[field] = this.applyRuleToDoc(
            result[field],
            subRule,
            `${pathContext}.${field}`,
          );
        }
      }
    }

    if (rule.embeddedArrays) {
      for (const [field, subRule] of Object.entries(rule.embeddedArrays)) {
        if (Array.isArray(result[field])) {
          result[field] = result[field].map((item: any, i: number) =>
            this.applyRuleToDoc(item, subRule, `${pathContext}.${field}[${i}]`),
          );
        }
      }
    }

    return result;
  }

  private tryCastObjectId(val: any, pathInfo: string): any {
    if (!val) return val;
    if (val instanceof Types.ObjectId) return val;

    // Ext JSON format
    if (val.$oid && typeof val.$oid === 'string') {
      if (Types.ObjectId.isValid(val.$oid)) {
        return new Types.ObjectId(val.$oid);
      } else {
        throw new Error(`Invalid ObjectId format at ${pathInfo}: ${val.$oid}`);
      }
    }

    if (typeof val === 'string') {
      if (Types.ObjectId.isValid(val)) {
        return new Types.ObjectId(val);
      } else {
        throw new Error(`Invalid ObjectId format at ${pathInfo}: ${val}`);
      }
    }

    return val; // It might be another unexpected type, but we don't blindly crash unless it was a string that failed validation
  }

  private tryCastDate(val: any): any {
    if (!val) return val;
    if (val instanceof Date) return val;

    if (val.$date) {
      const d = new Date(val.$date);
      if (!isNaN(d.getTime())) return d;
    }

    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
    return val;
  }
}
