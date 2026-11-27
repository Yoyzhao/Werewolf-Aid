export const RULES_CONTENT_VERSION = '0.1.0' as const;

export type RuleBoardId = 'pre-witch-hunter-guard' | 'pre-witch-hunter-idiot';

export type RuleRoleId =
  'SEER' | 'WITCH' | 'HUNTER' | 'GUARD' | 'IDIOT' | 'VILLAGER' | 'WOLF' | 'WOLF_KING';

export type RuleCamp = 'good' | 'wolf';

export type RuleRoleKind = 'god' | 'villager' | 'wolf';

export interface RuleBoardRoleSlot {
  readonly roleId: RuleRoleId;
  readonly count: number;
}

export interface RuleBoard {
  readonly id: RuleBoardId;
  readonly name: string;
  readonly playerCount: number;
  readonly roles: readonly RuleBoardRoleSlot[];
  readonly nightOrder: readonly RuleRoleId[];
  readonly winRule: string;
  readonly summary: string;
}

export interface RoleGuide {
  readonly roleId: RuleRoleId;
  readonly name: string;
  readonly camp: RuleCamp;
  readonly kind: RuleRoleKind;
  readonly skill: string;
  readonly limits: readonly string[];
  readonly tactics: readonly string[];
  readonly mistakes: readonly string[];
}

export type RulesFlowId = 'night' | 'day' | 'win';

export interface RulesFlow {
  readonly id: RulesFlowId;
  readonly title: string;
  readonly steps: readonly string[];
}

export interface RulesFooter {
  readonly text: string;
  readonly sources: readonly string[];
}

export type TermCategory = 'board' | 'role' | 'flow' | 'verdict' | 'slang';

export interface TermEntry {
  readonly id: string;
  readonly term: string;
  readonly aliases: readonly string[];
  readonly category: TermCategory;
  readonly summary: string;
  readonly detail: string;
}

export interface RulesContent {
  readonly version: string;
  readonly boards: readonly RuleBoard[];
  readonly roles: readonly RoleGuide[];
  readonly flows: readonly RulesFlow[];
  readonly terms: readonly TermEntry[];
  readonly footer: RulesFooter;
}

const BOARD_RECORD: Readonly<Record<RuleBoardId, RuleBoard>> = {
  'pre-witch-hunter-guard': {
    id: 'pre-witch-hunter-guard',
    name: '预女猎守',
    playerCount: 12,
    roles: [
      { roleId: 'SEER', count: 1 },
      { roleId: 'WITCH', count: 1 },
      { roleId: 'HUNTER', count: 1 },
      { roleId: 'GUARD', count: 1 },
      { roleId: 'VILLAGER', count: 4 },
      { roleId: 'WOLF', count: 4 },
    ],
    nightOrder: ['GUARD', 'SEER', 'WOLF', 'WITCH'],
    winRule: '屠边',
    summary: '4 神（预/女/猎/守）+ 4 民 + 4 普通狼；守卫提供夜间保护，容错更高。',
  },
  'pre-witch-hunter-idiot': {
    id: 'pre-witch-hunter-idiot',
    name: '预女猎白',
    playerCount: 12,
    roles: [
      { roleId: 'SEER', count: 1 },
      { roleId: 'WITCH', count: 1 },
      { roleId: 'HUNTER', count: 1 },
      { roleId: 'IDIOT', count: 1 },
      { roleId: 'VILLAGER', count: 4 },
      { roleId: 'WOLF', count: 3 },
      { roleId: 'WOLF_KING', count: 1 },
    ],
    nightOrder: ['SEER', 'WOLF', 'WITCH'],
    winRule: '屠边',
    summary: '4 神（预/女/猎/白痴）+ 4 民 + 3 普通狼 + 1 白狼王；白狼王自爆可带人，节奏更快。',
  },
};

const ROLE_GUIDE_RECORD: Readonly<Record<RuleRoleId, RoleGuide>> = {
  SEER: {
    roleId: 'SEER',
    name: '预言家',
    camp: 'good',
    kind: 'god',
    skill: '每夜查验一名玩家是“好人”还是“狼人”，不知具体身份。',
    limits: ['查验结果仅查验者可见'],
    tactics: [
      '首夜优先查验发言位或高嫌疑位，白天用验人结果建立逻辑链。',
      '上警时明确报出验人顺序与金水/查杀，避免含糊表述。',
      '用“警徽流”约定后续验人与警徽去向，减少好人误判。',
    ],
    mistakes: [
      '把“金水”当作绝对身份，忽略悍跳与狼人骗药。',
      '查验结果只报“好人/狼人”，不要声称知道具体角色。',
      '白天报验与夜间记录不一致，导致好人逻辑断裂。',
    ],
  },
  WITCH: {
    roleId: 'WITCH',
    name: '女巫',
    camp: 'good',
    kind: 'god',
    skill: '每夜至多使用一瓶药；解药仅可救当夜被刀者，毒药可毒杀一名玩家。',
    limits: ['每夜至多一瓶', '首夜可自救（默认，可关）', '同守同救目标死亡', '用药不公开'],
    tactics: [
      '首夜根据刀口与场上信息决定是否用解药，默认规则允许自救。',
      '毒药优先留给悍跳、查杀未出或明显狼面玩家，避免凭感觉开毒。',
      '用药后记录刀口与对象，白天用发言引导好人归票。',
    ],
    mistakes: [
      '同夜使用两瓶药（系统会拦截）。',
      '解药救非当夜被刀者，或空刀时强行用药。',
      '盲目毒掉神职或已证好人，直接浪费轮次。',
    ],
  },
  HUNTER: {
    roleId: 'HUNTER',
    name: '猎人',
    camp: 'good',
    kind: 'god',
    skill: '被狼刀或被放逐后可开枪带走一名玩家。',
    limits: ['被毒/殉情/白狼王带走不可开枪', '开枪公开'],
    tactics: [
      '被刀或放逐后优先带走逻辑上的狼，其次带走发言最差的疑似位。',
      '关键轮次可适度暗示身份，避免被狼人骗枪。',
      '提前准备“枪徽流”，说明开枪目标与警徽去向。',
    ],
    mistakes: [
      '误以为被毒或被白狼王带走也能开枪。',
      '过早明枪导致夜间被针对，或开枪带走好人。',
      '被放逐时不使用技能，浪费轮次。',
    ],
  },
  GUARD: {
    roleId: 'GUARD',
    name: '守卫',
    camp: 'good',
    kind: 'god',
    skill: '每夜守护一名玩家，使其免疫狼刀。',
    limits: ['不可连续两夜守同一人', '可自守（默认）', '不防毒', '守护对象不公开'],
    tactics: [
      '优先守护预言家、女巫等关键神职，必要时自守。',
      '记录每夜守护对象，规划下一夜不可连守。',
      '与女巫用药信息配合，避免同守同救导致目标死亡。',
    ],
    mistakes: [
      '连续两夜守护同一人（系统会拦截）。',
      '把守护当解药，认为可以防毒或救回同守目标。',
      '盲目自守导致关键神职无人保护。',
    ],
  },
  IDIOT: {
    roleId: 'IDIOT',
    name: '白痴',
    camp: 'good',
    kind: 'god',
    skill: '被放逐时翻牌免死，保留发言权。',
    limits: ['失去投票权', '不再成为放逐目标', '被刀/毒/枪死', '翻牌公开'],
    tactics: [
      '可主动上警或站边，吸引放逐火力，为神职争取轮次。',
      '翻牌后继续参与发言，帮助好人归票与总结。',
      '利用“不再成为放逐目标”的身份承担归票职责。',
    ],
    mistakes: [
      '翻牌后仍参与投票（已失去投票权）。',
      '以为翻牌后夜间也不会死，忽视狼刀与毒药。',
      '被放逐时拒绝翻牌，错过免死机会。',
    ],
  },
  VILLAGER: {
    roleId: 'VILLAGER',
    name: '平民',
    camp: 'good',
    kind: 'villager',
    skill: '无夜间技能，白天参与发言与投票。',
    limits: [],
    tactics: [
      '认真听发言，记录验人、票型与冲突点。',
      '跟随可信神职归票，关键时刻敢于站边。',
      '适度承受刀口，为神职挡刀。',
    ],
    mistakes: [
      '全程划水，不提供有效信息。',
      '跟风冲票或情绪化投票，帮助狼人带节奏。',
      '无依据乱跳神职，干扰好人判断。',
    ],
  },
  WOLF: {
    roleId: 'WOLF',
    name: '狼人',
    camp: 'wolf',
    kind: 'wolf',
    skill: '与狼队友共同击杀一名玩家。',
    limits: ['可空刀/自刀', '意见不一致按空刀', '刀口不公开'],
    tactics: [
      '夜间统一刀口，优先击杀关键神职或发言核心。',
      '可选择悍跳预言家、深水潜伏或倒钩站边。',
      '用自刀、空刀等战术扰乱好人判断。',
    ],
    mistakes: [
      '刀口意见不一致（系统按空刀处理）。',
      '白天发言聊爆或冲票过猛，暴露狼队。',
      '自刀或空刀后没有后续战术安排。',
    ],
  },
  WOLF_KING: {
    roleId: 'WOLF_KING',
    name: '白狼王',
    camp: 'wolf',
    kind: 'wolf',
    skill: '随狼人共同行动；白天自爆时可带走一名玩家。',
    limits: ['非自爆出局不可发动', '若为最后一狼，自爆不带人', '自爆公开'],
    tactics: [
      '在关键轮次自爆带人，优先带走预言家或女巫。',
      '自爆前与狼队确认目标，避免带错好人。',
      '作为最后一狼时谨慎自爆，避免直接送好人胜利。',
    ],
    mistakes: [
      '被放逐或被毒后试图发动带人（非自爆不可发动）。',
      '作为最后一狼自爆仍想带人（不带人且直接判负）。',
      '自爆不带人，浪费唯一技能。',
    ],
  },
};

export const RULE_BOARDS: readonly RuleBoard[] = Object.values(BOARD_RECORD);

export const ROLE_GUIDES: readonly RoleGuide[] = Object.values(ROLE_GUIDE_RECORD);

export const RULES_FLOWS: readonly RulesFlow[] = [
  {
    id: 'night',
    title: '一夜的流程',
    steps: [
      '守卫（在场时）选择守护目标；不可连续两夜守同一人。',
      '预言家查验一名玩家，结果仅主持人与预言家可见。',
      '狼人共同选择击杀目标；可空刀或自刀，意见不一致按空刀。',
      '女巫选择是否使用解药或毒药；每夜至多一瓶。',
      '结算夜间死亡：守护 → 狼刀 → 女巫 → 同守同救，随后公布死讯。',
    ],
  },
  {
    id: 'day',
    title: '一天的流程',
    steps: [
      '公布昨夜死讯；首夜死亡玩家有遗言。',
      '首日进行警长竞选：报名 → 发言 → 退水 → 警下投票 → 平票 PK；可无警长。',
      '按警长指定或死左/死右顺序发言，主持人记录要点。',
      '存活玩家投票放逐；警长 1.5 票，可弃票；平票 PK 复投。',
      '放逐结算：白痴翻牌免死、猎人开枪、警徽移交或撕毁，随后检查胜负。',
      '白天可自爆：中止当前流程 → 白狼王带人 → 警徽处理 → 胜负检查。',
    ],
  },
  {
    id: 'win',
    title: '怎么算赢',
    steps: [
      '狼人全部出局 → 好人胜利。',
      '神职全部出局或平民全部出局 → 狼人胜利（屠边）。',
      '每次夜间死亡结算、白天技能结算与自爆结算后检查胜负，满足即结算。',
    ],
  },
];

export const TERM_CATEGORIES: readonly TermCategory[] = [
  'board',
  'role',
  'flow',
  'verdict',
  'slang',
];

export const TERM_CATEGORY_LABELS: Readonly<Record<TermCategory, string>> = {
  board: '板子',
  role: '角色',
  flow: '流程',
  verdict: '判定',
  slang: '口语',
};

export const TERMS: readonly TermEntry[] = [
  {
    id: 'same-guard-save',
    term: '同守同救',
    aliases: ['同守同救规则'],
    category: 'verdict',
    summary: '守卫守护与女巫解药同时作用于同一名玩家时，该玩家仍然死亡。',
    detail:
      '结算顺序为守护 → 狼刀 → 女巫 → 同守同救。守卫只能挡狼刀，解药只能救刀口；两者叠加不产生额外保护，反而会让目标死亡。主持端会在夜间结算时自动判定。',
  },
  {
    id: 'consecutive-guard',
    term: '连守',
    aliases: ['连续守护'],
    category: 'flow',
    summary: '守卫不能连续两夜守护同一名玩家。',
    detail:
      '例如第 1 夜守护 5 号，第 2 夜不能再次选择 5 号；空守不占用守护记录。系统会对连守操作直接拦截。',
  },
  {
    id: 'badge-flow',
    term: '警徽流',
    aliases: ['警徽流向'],
    category: 'flow',
    summary: '预言家或警长提前约定的警徽移交顺序与后续验人安排。',
    detail:
      '常见写法如“警徽流 3、7”：先验 3 号，出局后警徽给 7 号。清晰的警徽流能减少好人因警徽去向产生分歧。',
  },
  {
    id: 'fake-claim',
    term: '悍跳',
    aliases: ['悍跳狼', '悍跳预言家'],
    category: 'slang',
    summary: '狼人白天主动冒充预言家等神职，用假验人争夺警徽与话语权。',
    detail: '悍跳通常配合狼队友冲票与倒钩；好人应对比验人逻辑、警徽流与票型，而不是只看语气。',
  },
  {
    id: 'self-explode',
    term: '自爆',
    aliases: ['白天自爆'],
    category: 'flow',
    summary: '狼人白天主动亮明身份出局，中止当前发言或投票流程。',
    detail: '自爆后直接进入黑夜；白狼王自爆可带走一名玩家。主持端会记录自爆事件并检查胜负。',
  },
  {
    id: 'gold-water',
    term: '金水',
    aliases: ['验金'],
    category: 'verdict',
    summary: '被预言家查验为“好人”的玩家。',
    detail:
      '金水只代表预言家视角下的好人，不等于绝对安全；若预言家是悍跳狼，金水也可能是被利用的好人。',
  },
  {
    id: 'check-kill',
    term: '查杀',
    aliases: ['验杀'],
    category: 'verdict',
    summary: '被预言家查验为“狼人”的玩家。',
    detail: '真预言家的查杀通常优先放逐；若出现双查杀，需要结合警徽流、票型与发言判断谁在悍跳。',
  },
  {
    id: 'silver-water',
    term: '银水',
    aliases: ['被救'],
    category: 'verdict',
    summary: '被女巫用解药救起的玩家。',
    detail: '银水说明该玩家当夜是狼刀目标，通常狼面较低；但狼人自刀骗药时也会产生银水。',
  },
  {
    id: 'hook-wolf',
    term: '倒钩',
    aliases: ['倒钩狼'],
    category: 'slang',
    summary: '狼人站边真预言家或好人阵营，以骗取信任、后期带偏节奏。',
    detail: '倒钩狼往往发言积极、票型“正确”；好人需要观察其在关键轮次的归票是否真正有利于好人。',
  },
  {
    id: 'charge-wolf',
    term: '冲锋狼',
    aliases: ['冲锋'],
    category: 'slang',
    summary: '主动带节奏、冲票或强推对跳的狼人。',
    detail: '冲锋狼常与悍跳狼配合，一明一暗；若冲锋过猛露出破绽，狼队也可能让其自爆止损。',
  },
  {
    id: 'empty-kill',
    term: '空刀',
    aliases: ['狼人空刀'],
    category: 'flow',
    summary: '狼人当夜不选择击杀目标。',
    detail: '狼人意见不一致时按空刀处理；空刀可用于迷惑好人或配合自刀战术。',
  },
  {
    id: 'empty-guard',
    term: '空守',
    aliases: ['守卫空守'],
    category: 'flow',
    summary: '守卫当夜不守护任何玩家。',
    detail: '空守不占用守护记录，不会触发连守限制；常用于没有明确保护目标时保留选择空间。',
  },
  {
    id: 'slaughter-edge',
    term: '屠边',
    aliases: ['屠边胜利'],
    category: 'verdict',
    summary: '狼人让神职全部出局或平民全部出局即获胜的规则。',
    detail:
      '当前两套板子均采用屠边；因此狼人刀口会优先打穿神职或平民的一侧，好人需要平衡两侧存活。',
  },
  {
    id: 'sheriff-badge',
    term: '警长',
    aliases: ['警徽'],
    category: 'flow',
    summary: '白天竞选出的一人，拥有 1.5 票与发言顺序决定权。',
    detail:
      '首日竞选：报名 → 发言 → 退水 → 警下投票 → 平票 PK；也可无人上警。警长出局后可移交或撕毁警徽。',
  },
];

export const RULES_FOOTER: RulesFooter = {
  text: '依据规则资料整理，以开局约定为准',
  sources: ['PRD 附录 A 规则口径表', 'PRD 附录 B 板子配置', '《狼人杀》规则资料汇编'],
};

export const RULES_CONTENT: RulesContent = {
  version: RULES_CONTENT_VERSION,
  boards: RULE_BOARDS,
  roles: ROLE_GUIDES,
  flows: RULES_FLOWS,
  terms: TERMS,
  footer: RULES_FOOTER,
};

export function getRuleBoard(boardId: RuleBoardId): RuleBoard {
  return BOARD_RECORD[boardId];
}

export function getRoleGuide(roleId: RuleRoleId): RoleGuide {
  return ROLE_GUIDE_RECORD[roleId];
}
