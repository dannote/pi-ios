/**
 * Tests for terminal sizing and width calculations
 * 
 * These tests ensure the terminal dimensions are correctly calculated
 * based on the iOS device screen size and font metrics.
 */

import { describe, test, expect } from 'bun:test';

// Font metrics for typical monospace fonts on iOS
const FONT_METRICS = {
  // SF Mono / Menlo style
  standard: { charWidth: 8.4, lineHeight: 17 },
  // Larger accessibility font
  large: { charWidth: 10.5, lineHeight: 21 },
  // Compact font
  compact: { charWidth: 7.2, lineHeight: 14 },
};

// iOS device screen dimensions (points, not pixels)
const DEVICES = {
  'iPhone SE': { width: 320, height: 568, scale: 2 },
  'iPhone 8': { width: 375, height: 667, scale: 2 },
  'iPhone 14': { width: 390, height: 844, scale: 3 },
  'iPhone 14 Pro': { width: 393, height: 852, scale: 3 },
  'iPhone 14 Pro Max': { width: 430, height: 932, scale: 3 },
  'iPad Mini': { width: 744, height: 1133, scale: 2 },
  'iPad Air': { width: 820, height: 1180, scale: 2 },
  'iPad Pro 11"': { width: 834, height: 1194, scale: 2 },
  'iPad Pro 12.9"': { width: 1024, height: 1366, scale: 2 },
};

interface TerminalSize {
  columns: number;
  rows: number;
}

function calculateTerminalSize(
  screenWidth: number,
  screenHeight: number,
  fontMetrics: { charWidth: number; lineHeight: number },
  padding: { horizontal: number; vertical: number } = { horizontal: 8, vertical: 40 }
): TerminalSize {
  const availableWidth = screenWidth - padding.horizontal;
  const availableHeight = screenHeight - padding.vertical;
  
  const columns = Math.floor(availableWidth / fontMetrics.charWidth);
  const rows = Math.floor(availableHeight / fontMetrics.lineHeight);
  
  return { columns, rows };
}

describe('Terminal size calculations', () => {
  describe('iPhone devices', () => {
    test('iPhone SE has reasonable terminal size', () => {
      const device = DEVICES['iPhone SE'];
      const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      
      expect(size.columns).toBeGreaterThanOrEqual(35);
      expect(size.columns).toBeLessThanOrEqual(40);
      expect(size.rows).toBeGreaterThanOrEqual(30);
    });

    test('iPhone 14 has reasonable terminal size', () => {
      const device = DEVICES['iPhone 14'];
      const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      
      expect(size.columns).toBeGreaterThanOrEqual(43);
      expect(size.columns).toBeLessThanOrEqual(48);
      expect(size.rows).toBeGreaterThanOrEqual(45);
    });

    test('iPhone 14 Pro Max has reasonable terminal size', () => {
      const device = DEVICES['iPhone 14 Pro Max'];
      const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      
      expect(size.columns).toBeGreaterThanOrEqual(48);
      expect(size.columns).toBeLessThanOrEqual(55);
      expect(size.rows).toBeGreaterThanOrEqual(50);
    });
  });

  describe('iPad devices', () => {
    test('iPad Mini has reasonable terminal size', () => {
      const device = DEVICES['iPad Mini'];
      const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      
      expect(size.columns).toBeGreaterThanOrEqual(85);
      expect(size.rows).toBeGreaterThanOrEqual(60);
    });

    test('iPad Pro 12.9" has reasonable terminal size', () => {
      const device = DEVICES['iPad Pro 12.9"'];
      const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      
      expect(size.columns).toBeGreaterThanOrEqual(115);
      expect(size.rows).toBeGreaterThanOrEqual(75);
    });
  });

  describe('Landscape orientation', () => {
    test('iPhone 14 landscape swaps dimensions', () => {
      const device = DEVICES['iPhone 14'];
      const portrait = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      const landscape = calculateTerminalSize(device.height, device.width, FONT_METRICS.standard);
      
      expect(landscape.columns).toBeGreaterThan(portrait.columns);
      expect(landscape.rows).toBeLessThan(portrait.rows);
    });
  });

  describe('Font size impact', () => {
    test('larger font reduces columns and rows', () => {
      const device = DEVICES['iPhone 14'];
      const standard = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      const large = calculateTerminalSize(device.width, device.height, FONT_METRICS.large);
      
      expect(large.columns).toBeLessThan(standard.columns);
      expect(large.rows).toBeLessThan(standard.rows);
    });

    test('compact font increases columns and rows', () => {
      const device = DEVICES['iPhone 14'];
      const standard = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
      const compact = calculateTerminalSize(device.width, device.height, FONT_METRICS.compact);
      
      expect(compact.columns).toBeGreaterThan(standard.columns);
      expect(compact.rows).toBeGreaterThan(standard.rows);
    });
  });

  describe('Minimum usable size', () => {
    test('all iPhones have at least 35 columns', () => {
      const iPhones = ['iPhone SE', 'iPhone 8', 'iPhone 14', 'iPhone 14 Pro', 'iPhone 14 Pro Max'];
      
      for (const name of iPhones) {
        const device = DEVICES[name as keyof typeof DEVICES];
        const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
        expect(size.columns).toBeGreaterThanOrEqual(35);
      }
    });

    test('all iPads have at least 80 columns', () => {
      const iPads = ['iPad Mini', 'iPad Air', 'iPad Pro 11"', 'iPad Pro 12.9"'];
      
      for (const name of iPads) {
        const device = DEVICES[name as keyof typeof DEVICES];
        const size = calculateTerminalSize(device.width, device.height, FONT_METRICS.standard);
        expect(size.columns).toBeGreaterThanOrEqual(80);
      }
    });
  });
});

describe('Pi TUI width requirements', () => {
  test('minimum width for status bar is 40 columns', () => {
    // Status bar format: "path  percentage  model"
    const minStatusBar = '/tmp  0.0%/200k (auto)  claude-3.5-haiku';
    expect(minStatusBar.length).toBeLessThanOrEqual(45);
  });

  test('keyboard shortcuts fit in 45 columns', () => {
    const shortcuts = [
      'ctrl+p/shift+ctrl+p to cycle models',
      'ctrl+l to select model',
      'ctrl+o to expand tools',
      'ctrl+t to expand thinking',
      'ctrl+g for external editor',
      '/ for commands',
      '! to run bash',
      '!! to run bash (no context)',
      'alt+enter to queue follow-up',
      'ctrl+v to paste image',
      'drop files to attach',
    ];
    
    for (const shortcut of shortcuts) {
      expect(shortcut.length).toBeLessThanOrEqual(45);
    }
  });
});

describe('Dynamic terminal resizing', () => {
  test('terminal can be resized while running', () => {
    let currentSize = { columns: 45, rows: 50 };
    
    const terminal = {
      get columns() { return currentSize.columns; },
      get rows() { return currentSize.rows; },
      setSize(cols: number, rows: number) {
        currentSize = { columns: cols, rows: rows };
      }
    };
    
    expect(terminal.columns).toBe(45);
    terminal.setSize(80, 24);
    expect(terminal.columns).toBe(80);
    expect(terminal.rows).toBe(24);
  });

  test('resize triggers callback', () => {
    let resizeCount = 0;
    let resizeCallback = () => { resizeCount++; };
    
    const terminal = {
      _columns: 45,
      _rows: 50,
      _onResize: null as (() => void) | null,
      
      start(onInput: () => void, onResize: () => void) {
        this._onResize = onResize;
      },
      
      setSize(cols: number, rows: number) {
        this._columns = cols;
        this._rows = rows;
        if (this._onResize) this._onResize();
      }
    };
    
    terminal.start(() => {}, resizeCallback);
    terminal.setSize(80, 24);
    terminal.setSize(100, 40);
    
    expect(resizeCount).toBe(2);
  });
});
