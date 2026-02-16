/**
 * NavigationBrain Tests
 */

import { KeyboardController } from '../../utils/automation/KeyboardController.js';
import { OCRFactory } from '../../utils/ocr/OCRFactory.js';
import { Monitor } from 'node-screenshots';

describe('NavigationBrain', () => {
  describe('Spotlight Navigation', () => {
    it('should open Spotlight and verify Spotlight Search text appears', async () => {
      const startTime = Date.now();
      console.log('[Test] 테스트 시작');

      // 1. Cmd + Space 누르기
      const step1Start = Date.now();
      console.log('[Step 1] Spotlight 열기 시작...');
      await KeyboardController.pressKey('space', ['command']);
      console.log(`[Step 1] Spotlight 열기 완료 (${Date.now() - step1Start}ms)`);

      // 2. Backspace 누르기
      const step2Start = Date.now();
      console.log('[Step 2] Backspace 누르기 시작...');
      await KeyboardController.pressKey('backspace');
      console.log(`[Step 2] Backspace 누르기 완료 (${Date.now() - step2Start}ms)`);

      // 3. OCR 수행
      const step3Start = Date.now();
      console.log('[Step 3] 화면 캡처 시작...');
      const monitors = Monitor.all();
      const primaryMonitor = monitors[0];
      const image = primaryMonitor.captureImageSync();
      const pngBuffer = image.toPngSync();
      console.log(`[Step 3] 화면 캡처 완료 (${Date.now() - step3Start}ms)`);

      const step4Start = Date.now();
      console.log('[Step 4] OCR 분석 시작...');
      const ocrProvider = OCRFactory.create();
      expect(ocrProvider).toBeDefined();

      const ocrResult = await ocrProvider!.analyzeBuffer(pngBuffer);
      console.log(`[Step 4] OCR 분석 완료 (${Date.now() - step4Start}ms)`);
      console.log(`[Step 4] OCR 결과: ${ocrResult.elements.length}개 요소 발견`);

      // 4. OCR 결과에서 'spotlight 검색' 존재 확인
      const step5Start = Date.now();
      console.log('[Step 5] Spotlight 텍스트 검증 시작...');
      const hasSpotlightText = ocrResult.elements.some((el) =>
        el.text.toLowerCase().includes('spotlight 검색')
      );

      console.log('[Step 5] 발견된 텍스트:', ocrResult.elements.map(el => el.text).join(', '));
      console.log(`[Step 5] Spotlight 텍스트 검증 완료 (${Date.now() - step5Start}ms)`);

      expect(hasSpotlightText).toBe(true);

      console.log(`[Test] 전체 테스트 완료 (${Date.now() - startTime}ms)`);

      // TODO: 뒷동작 추가 예정
    });
  });
});
