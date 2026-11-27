import { expect, test, type Page } from '@playwright/test';

import { enterVote, expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-031';

const ROLE_SEQUENCE = [
  'GUARD',
  'SEER',
  'WITCH',
  'HUNTER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'WOLF',
  'WOLF',
  'WOLF',
  'WOLF',
];

const FINISHED_RECORD = {
  schemaVersion: 1,
  status: 'finished',
  phase: 'RESULT',
  view: 'result',
  round: 2,
  nightStep: 0,
  state: {
    schemaVersion: 1,
    boardId: 'pre-witch-hunter-guard',
    phase: 'RESULT',
    status: 'finished',
    round: 2,
    nightStep: 0,
    dealMode: 'C',
    options: { sheriffElection: true, witchSelfSaveFirstNight: true },
    seats: ROLE_SEQUENCE.map((role, index) => ({
      no: index + 1,
      role,
      alive: index < 8,
      idiotRevealed: false,
      deathCause: index < 8 ? null : 'VOTE',
      deathRound: index < 8 ? null : 2,
    })),
    sheriffNo: 1,
    sheriffElection: null,
    nightActions: [
      { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
      { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
      { round: 1, step: 3, roleId: 'WITCH', target: 5, potion: 'ANTIDOTE' },
    ],
    ballots: [],
    pkCandidates: [],
    voteRound: 1,
    exiledSeat: null,
    exileResolved: false,
    explodingSeat: null,
    interruptedPhase: null,
    pendingHunterNo: null,
    pendingBadge: false,
    pendingWolfKingTake: false,
    lastNightDeaths: [],
    resumeTo: null,
    events: [
      { seq: 1, round: 1, phase: 'NIGHT', type: 'NO_DEATH', seatNos: [] },
      { seq: 2, round: 1, phase: 'SHERIFF', type: 'SHERIFF_ELECTED', seatNos: [1] },
      { seq: 3, round: 2, phase: 'VOTE', type: 'EXILE', seatNos: [9] },
    ],
    result: { winner: 'good', round: 2 },
  },
  history: [],
  boardId: 'pre-witch-hunter-guard',
  dealMode: 'C',
  options: { sheriffElection: true, witchSelfSaveFirstNight: true },
  dealDraft: null,
  updatedAt: Date.now(),
};

async function quickVote(page: Page, target: number): Promise<void> {
  await page.getByRole('button', { name: '快速归票' }).click();
  await page.getByRole('button', { name: `${target} 号` }).click();
  await page.getByRole('button', { name: new RegExp(`^归票给 ${target} 号`) }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('首个白天投票 → 放逐 → 下一夜', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterVote(page);

  await expect(page.getByRole('button', { name: '还有 11 位未录票' })).toBeDisabled();
  await page.screenshot({ path: `${EVIDENCE}/vote-390.png` });

  await quickVote(page, 9);
  await expect(page.getByText('9 号 · 11 票')).toBeVisible();

  await page.getByRole('button', { name: '放逐并检查胜负' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '放逐并检查胜负' }).click();

  await expect(page.getByRole('heading', { name: '放逐结果' })).toBeVisible();
  await expect(page.getByText('9 号被放逐')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/settle-390.png` });

  await page.getByRole('button', { name: '结束放逐，检查胜负' }).click();
  await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
  await expect(page.getByText(/第 2 夜/)).toBeVisible();
});

test('投票进度刷新后可恢复', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterVote(page);
  await quickVote(page, 9);
  await expect(page.getByText('9 号 · 11 票')).toBeVisible();

  // 等待 IndexedDB 落盘完成，避免并发负载下刷新读到旧快照。
  await page.waitForFunction(async () => {
    const record = await new Promise<{ state?: { ballots?: unknown[] } } | undefined>((resolve) => {
      const open = indexedDB.open('keyval-store');
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('keyval')) {
          open.result.createObjectStore('keyval');
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        try {
          const request = db
            .transaction('keyval', 'readonly')
            .objectStore('keyval')
            .get('lrs.game.current.v1');
          request.onsuccess = () => {
            resolve(request.result as { state?: { ballots?: unknown[] } } | undefined);
            db.close();
          };
          request.onerror = () => resolve(undefined);
        } catch {
          db.close();
          resolve(undefined);
        }
      };
      open.onerror = () => resolve(undefined);
    });
    return record?.state?.ballots?.length === 11;
  });

  await page.reload();
  await expect(page.getByText(/继续上一局/)).toBeVisible();
  await page.getByRole('button', { name: '继续' }).click();

  await expect(page.getByRole('heading', { name: '放逐投票' })).toBeVisible();
  await expect(page.getByText('已录 11 / 11')).toBeVisible();
  await expect(page.getByText('9 号 · 11 票')).toBeVisible();
});

test('断网后投票仍可继续', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterVote(page);

  await page.context().setOffline(true);
  await quickVote(page, 9);
  await expect(page.getByText('9 号 · 11 票')).toBeVisible();
  await expect(page.getByRole('button', { name: '放逐并检查胜负' })).toBeEnabled();
  await page.context().setOffline(false);
});

test('投票与放逐结果在 320/430 宽度无横向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterVote(page);

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page, `${width}px 投票`);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: `${EVIDENCE}/vote-320.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await quickVote(page, 9);
  await page.getByRole('button', { name: '放逐并检查胜负' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '放逐并检查胜负' }).click();
  await expect(page.getByRole('heading', { name: '放逐结果' })).toBeVisible();

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page, `${width}px 放逐结果`);
  }
  await page.setViewportSize({ width: 430, height: 844 });
  await page.screenshot({ path: `${EVIDENCE}/settle-430.png` });
});

test('已完成对局可查看只读结算并再来一局', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(async (record) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('keyval-store', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('keyval');
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(record, 'lrs.game.current.v1');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, FINISHED_RECORD);

  await page.reload();
  await expect(page.getByText('上一局已结束')).toBeVisible();
  await page.getByRole('button', { name: '查看上一局结果' }).click();

  await expect(page.getByRole('heading', { name: '结算' })).toBeVisible();
  await expect(page.getByText('好人阵营胜利')).toBeVisible();
  await expect(page.getByText('身份揭晓')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/result-390.png` });

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page, `${width}px 结算`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '再来一局' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '再来一局' }).click();
  await expect(page.getByRole('heading', { name: '开局设置' })).toBeVisible();
});
