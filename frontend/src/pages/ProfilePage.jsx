import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { dateLocale } from '../utils/dateLocale';
import useAuthStore from '../store/authStore';

const Field = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>{label}</div>
    <div style={{ fontWeight: 500 }}>{value ?? '-'}</div>
  </div>
);

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-2xl">
      <section className="card blueprint p-6">
        <div className="flex items-center gap-4 mb-5">
          <span
            className="flex items-center justify-center"
            style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontFamily: 'var(--font-heading)', fontSize: 18 }}
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
          <div>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-heading)' }}>{user?.firstName} {user?.lastName}</div>
            <span className="tag tag-accent">{user?.role}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Field label={t('auth.email')} value={user?.email} />
          <Field label={t('auth.department')} value={user?.department} />
          <Field label={t('auth.position')} value={user?.position} />
          <Field label={t('attendance.workingHoursPerDay')} value={user?.workingHoursPerDay} />
          <Field label={t('auth.salary')} value={user?.salary ? `₾${Number(user.salary).toFixed(0)}` : '-'} />
          <Field label={t('common.phone')} value={user?.phone} />
          <Field label={t('common.status')} value={user?.status ? t(`userStatus.${user.status}`) : '-'} />
          <Field label={t('common.memberSince')} value={user?.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy', { locale: dateLocale() }) : '-'} />
        </div>
      </section>
    </div>
  );
}
