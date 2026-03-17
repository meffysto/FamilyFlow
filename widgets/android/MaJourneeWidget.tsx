/**
 * MaJourneeWidget.tsx — Widget Android "Ma Journée"
 *
 * Affiche repas, progression tâches et prochains RDV.
 * Utilise les primitives react-native-android-widget (pas de composants RN).
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface WidgetRDV {
  title: string;
  date: string;
  heure: string;
  lieu: string | null;
}

interface WidgetData {
  date: string;
  dayOfWeek: string;
  meals: { dejeuner: string | null; diner: string | null };
  tasksProgress: { done: number; total: number };
  nextTasks: string[];
  nextRDVs: WidgetRDV[];
}

export function MaJourneeWidget({ data }: { data: WidgetData | null }) {
  const progress = data?.tasksProgress ?? { done: 0, total: 0 };
  const tasks = data?.nextTasks ?? [];
  const meals = data?.meals ?? { dejeuner: null, diner: null };
  const rdvs = data?.nextRDVs ?? [];
  const dayName = data?.dayOfWeek ?? 'Aujourd\'hui';

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <FlexWidget
      style={{
        flex: 1,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        flexGap: 6,
      }}
      clickAction="OPEN_APP"
    >
      {/* En-tête : jour */}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget
          text={dayName}
          style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
        />
        {progress.total > 0 && (
          <TextWidget
            text={`${progress.done}/${progress.total} tâches`}
            style={{ fontSize: 11, fontWeight: '600', color: progressPct === 100 ? '#059669' : '#6B7280' }}
          />
        )}
      </FlexWidget>

      {/* Repas */}
      <FlexWidget style={{ flexDirection: 'row', flexGap: 12 }}>
        <FlexWidget style={{ flex: 1, flexGap: 2 }}>
          <TextWidget
            text="Déjeuner"
            style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF' }}
          />
          <TextWidget
            text={meals.dejeuner || '—'}
            style={{ fontSize: 12, fontWeight: '500', color: meals.dejeuner ? '#111827' : '#D1D5DB' }}
            maxLines={1}
          />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexGap: 2 }}>
          <TextWidget
            text="Dîner"
            style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF' }}
          />
          <TextWidget
            text={meals.diner || '—'}
            style={{ fontSize: 12, fontWeight: '500', color: meals.diner ? '#111827' : '#D1D5DB' }}
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Barre de progression */}
      {progress.total > 0 && (
        <FlexWidget style={{ flexDirection: 'row', height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }}>
          {progressPct > 0 && (
            <FlexWidget
              style={{
                flex: progressPct,
                height: 4,
                backgroundColor: progressPct === 100 ? '#10B981' : '#6366F1',
                borderRadius: 2,
              }}
            />
          )}
          {progressPct < 100 && (
            <FlexWidget style={{ flex: 100 - progressPct, height: 4 }} />
          )}
        </FlexWidget>
      )}

      {/* Tâches à faire */}
      {tasks.length > 0 && (
        <FlexWidget style={{ flexGap: 2 }}>
          {tasks.slice(0, 2).map((task, idx) => (
            <TextWidget
              key={`task-${idx}`}
              text={`• ${task}`}
              style={{ fontSize: 11, color: '#374151', fontWeight: '500' }}
              maxLines={1}
            />
          ))}
        </FlexWidget>
      )}

      {/* Prochain RDV */}
      {rdvs.length > 0 && (
        <TextWidget
          text={`📅 ${rdvs[0].heure} — ${rdvs[0].title}`}
          style={{ fontSize: 11, color: '#6366F1', fontWeight: '600' }}
          maxLines={1}
        />
      )}

      {/* État vide */}
      {progress.total === 0 && tasks.length === 0 && rdvs.length === 0 && !meals.dejeuner && !meals.diner && (
        <TextWidget
          text="Rien de prévu pour aujourd'hui"
          style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}
        />
      )}
    </FlexWidget>
  );
}
