/**
 * widget-task-handler.tsx — Gestionnaire de cycle de vie du widget Android
 *
 * Appelé par le système Android lors des événements widget.
 * Lit les données depuis un cache JSON stocké dans le FileSystem.
 */

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import * as FileSystem from 'expo-file-system/legacy';
import { MaJourneeWidget } from './MaJourneeWidget';
import { JournalBebeWidget } from './JournalBebeWidget';

const WIDGET_CACHE = `${FileSystem.documentDirectory}widget-data.json`;
const JOURNAL_CACHE = `${FileSystem.documentDirectory}journal-widget-data.json`;

async function loadJsonCache(path: string) {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const json = await FileSystem.readAsStringAsync(path);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  if (widgetAction === 'WIDGET_DELETED') return;

  if (widgetInfo.widgetName === 'MaJourneeWidget') {
    const data = await loadJsonCache(WIDGET_CACHE);
    renderWidget(<MaJourneeWidget data={data} />);
  } else if (widgetInfo.widgetName === 'JournalBebeWidget') {
    const data = await loadJsonCache(JOURNAL_CACHE);
    renderWidget(<JournalBebeWidget data={data} />);
  }
}
