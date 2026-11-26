export type Camp = 'good' | 'wolf';

export type RoleKind = 'god' | 'villager' | 'wolf';

export type RoleId =
  'SEER' | 'WITCH' | 'HUNTER' | 'GUARD' | 'IDIOT' | 'VILLAGER' | 'WOLF' | 'WOLF_KING';

export type NightActionKind = 'protect' | 'inspect' | 'kill' | 'potion';

export interface RoleDefinition {
  readonly id: RoleId;
  readonly name: string;
  readonly camp: Camp;
  readonly kind: RoleKind;
  /** 夜间主动动作；null 表示无独立夜间步骤（白狼王随狼人行动）。 */
  readonly nightAction: NightActionKind | null;
  readonly skill: string;
  readonly limits: readonly string[];
}

export const ROLE_DEFINITIONS: Readonly<Record<RoleId, RoleDefinition>> = {
  SEER: {
    id: 'SEER',
    name: '预言家',
    camp: 'good',
    kind: 'god',
    nightAction: 'inspect',
    skill: '每夜查验一名玩家是“好人”还是“狼人”，不知具体身份。',
    limits: ['查验结果仅查验者可见'],
  },
  WITCH: {
    id: 'WITCH',
    name: '女巫',
    camp: 'good',
    kind: 'god',
    nightAction: 'potion',
    skill: '每夜至多使用一瓶药；解药仅可救当夜被刀者，毒药可毒杀一名玩家。',
    limits: ['每夜至多一瓶', '首夜可自救（默认，可关）', '同守同救目标死亡', '用药不公开'],
  },
  HUNTER: {
    id: 'HUNTER',
    name: '猎人',
    camp: 'good',
    kind: 'god',
    nightAction: null,
    skill: '被狼刀或被放逐后可开枪带走一名玩家。',
    limits: ['被毒/殉情/白狼王带走不可开枪', '开枪公开'],
  },
  GUARD: {
    id: 'GUARD',
    name: '守卫',
    camp: 'good',
    kind: 'god',
    nightAction: 'protect',
    skill: '每夜守护一名玩家，使其免疫狼刀。',
    limits: ['不可连续两夜守同一人', '可自守（默认）', '不防毒', '守护对象不公开'],
  },
  IDIOT: {
    id: 'IDIOT',
    name: '白痴',
    camp: 'good',
    kind: 'god',
    nightAction: null,
    skill: '被放逐时翻牌免死，保留发言权。',
    limits: ['失去投票权', '不再成为放逐目标', '被刀/毒/枪死', '翻牌公开'],
  },
  VILLAGER: {
    id: 'VILLAGER',
    name: '平民',
    camp: 'good',
    kind: 'villager',
    nightAction: null,
    skill: '无夜间技能，白天参与发言与投票。',
    limits: [],
  },
  WOLF: {
    id: 'WOLF',
    name: '狼人',
    camp: 'wolf',
    kind: 'wolf',
    nightAction: 'kill',
    skill: '与狼队友共同击杀一名玩家。',
    limits: ['可空刀/自刀', '意见不一致按空刀', '刀口不公开'],
  },
  WOLF_KING: {
    id: 'WOLF_KING',
    name: '白狼王',
    camp: 'wolf',
    kind: 'wolf',
    nightAction: null,
    skill: '随狼人共同行动；白天自爆时可带走一名玩家。',
    limits: ['非自爆出局不可发动', '若为最后一狼，自爆不带人', '自爆公开'],
  },
};

export function isRoleId(value: string): value is RoleId {
  return Object.hasOwn(ROLE_DEFINITIONS, value);
}
