import { CalendarDays, Download, HandHeart, PackageCheck, Sparkles, Timer, Trophy } from 'lucide-react';
import type { YearReview } from '../core/pet';
import { t } from '../i18n';
import { createReviewAlbumData } from './albumData';
import { DialogShell } from './DialogShell';

import { features } from '../platform/edition';

interface YearReviewModalProps {
  review: YearReview;
  isSaving: boolean;
  saveFeedback: string;
  onSave: () => void;
  onClose: () => void;
}

export const YearReviewModal = ({ review, isSaving, saveFeedback, onSave, onClose }: YearReviewModalProps) => {
  const sharedData = createReviewAlbumData('', review);
  const icons = [CalendarDays, Sparkles, HandHeart, PackageCheck, Timer, Trophy];

  return (
      <DialogShell className="year-review-modal" labelId="year-review-title" onClose={onClose} closeOnEscape={false}>
        <div className="year-review-modal__header">
          <h2 id="year-review-title">{t('ui.yearReview.title', { year: review.year })}</h2>
        </div>
        <div className="year-review-modal__grid">
          {sharedData.metrics.map((data, index) => {
            const Icon = icons[index];
            return (
              <div className="year-review-modal__metric" data-tone={data.tone} key={data.label}>
                <Icon size={20} aria-hidden="true" />
                <span>{data.label}</span>
                <strong>{data.value}</strong>
              </div>
            );
          })}
        </div>
        <div className="year-review-modal__actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!features.shareCards || isSaving}
            title={!features.shareCards ? t('ui.editionNotice.restricted') : undefined}
            onClick={onSave}
          >
            <Download size={18} aria-hidden="true" />
            {isSaving ? t('ui.yearReview.cardSaving') : t('ui.yearReview.cardSave')}
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            {t('ui.yearReview.confirm')}
          </button>
        </div>
        {saveFeedback && <p className="year-review-modal__feedback" role="status">{saveFeedback}</p>}
      </DialogShell>
  );
};
