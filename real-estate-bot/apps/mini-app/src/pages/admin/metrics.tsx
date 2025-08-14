import useSWR from 'swr';

export default function MetricsPage() {
  const { data, error, isLoading } = useSWR('/api/metrics', (url) => fetch(url, { headers: { 'X-Init-Data': (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : '') || '' } }).then(r => r.json()), { refreshInterval: 30000 });

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Метрики</h1>
      {isLoading && <p>Загрузка...</p>}
      {error && <p className="text-red-500">Ошибка загрузки</p>}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Пользователи" value={data.totals?.users} />
            <Stat label="Объекты" value={data.totals?.listings} />
            <Stat label="Рекомендации" value={data.totals?.recommendations} />
            <Stat label="Клики" value={data.totals?.clicks} />
            <Stat label="Подписки" value={data.totals?.subscriptions} />
            <Stat label="Новые (24ч)" value={data.newUsers24h} />
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
            <h2 className="font-semibold mb-2">Топ рекомендаций</h2>
            <ul className="list-disc ml-5">
              {data.topRecommendations?.map((r: any) => (
                <li key={r.listingId} className="text-sm">{r.listingId} — score {r.score?.toFixed?.(1) ?? r.score}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className="text-xl font-bold">{value ?? 0}</div>
    </div>
  );
}