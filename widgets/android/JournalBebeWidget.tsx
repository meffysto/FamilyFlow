/**
 * JournalBebeWidget.tsx — Widget Android "Journal Bébé"
 *
 * Affiche le dernier repas, les stats du jour (biberons/tétées),
 * et un lien vers le journal dans l'app.
 * Note : pas de timer tétée sur Android (limitation RemoteViews).
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface JournalWidgetData {
  childName: string;
  lastFeedingLabel: string;
  lastFeedingType: string | null;
  todayBiberons: number;
  todayTetees: number;
}

export function JournalBebeWidget({ data }: { data: JournalWidgetData | null }) {
  const childName = data?.childName || 'Bébé';
  const lastLabel = data?.lastFeedingLabel || 'Aucun repas';
  const lastType = data?.lastFeedingType;
  const biberons = data?.todayBiberons ?? 0;
  const tetees = data?.todayTetees ?? 0;
  const total = biberons + tetees;

  const lastEmoji = lastType === 'biberon' ? '🍼' : lastType === 'tétée' ? '🤱' : '👶';

  return (
    <FlexWidget
      style={{
        flex: 1,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        flexGap: 8,
      }}
      clickAction="OPEN_APP"
      clickActionData={{ uri: `family-vault://open/journal` }}
    >
      {/* En-tête */}
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
        <TextWidget
          text="👶"
          style={{ fontSize: 14 }}
        />
        <TextWidget
          text={`Journal ${childName}`}
          style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}
        />
      </FlexWidget>

      {/* Dernier repas */}
      <FlexWidget style={{ flexGap: 2 }}>
        <TextWidget
          text="Dernier repas"
          style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF' }}
        />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          <TextWidget
            text={lastEmoji}
            style={{ fontSize: 16 }}
          />
          <TextWidget
            text={lastLabel}
            style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Stats du jour */}
      <FlexWidget style={{ flexDirection: 'row', flexGap: 16 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          <TextWidget
            text="🍼"
            style={{ fontSize: 12 }}
          />
          <TextWidget
            text={`${biberons}`}
            style={{ fontSize: 13, fontWeight: '700', color: '#3B82F6' }}
          />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          <TextWidget
            text="🤱"
            style={{ fontSize: 12 }}
          />
          <TextWidget
            text={`${tetees}`}
            style={{ fontSize: 13, fontWeight: '700', color: '#EC4899' }}
          />
        </FlexWidget>
        {total > 0 && (
          <TextWidget
            text={`${total} repas aujourd'hui`}
            style={{ fontSize: 11, color: '#9CA3AF' }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
