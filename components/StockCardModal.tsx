import React, { useState } from 'react';

interface Row {
  id: string;
  date: string;
  ref: string;
  wh: string;
  type: string;
  note: string;
  inQty: number;
  outQty: number;
  balance: number;
}

interface Props {
  item: { code: string; name: string; baseUnit: string };
  startDate: string;
  endDate: string;
  whName: string;
  rows: Row[];
  summary: {
    totalIn: number;
    totalOut: number;
    closing: number;
  };
  openingBalance: number;
  onOpenRow?: (row: Row) => void;
}

export const StockCardView: React.FC<Props> = ({
  item,
  startDate,
  endDate,
  whName,
  rows,
  summary,
  openingBalance,
  onOpenRow
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, rows.length - 1));
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }

    if (e.key === 'Enter' && activeIndex >= 0) {
      const row = rows[activeIndex];
      onOpenRow?.(row);
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="w-full h-full bg-white text-[11px] font-mono outline-none flex flex-col"
    >

      {/* HEADER */}
      <div className="border-b border-gray-400 px-4 py-2">
        <div className="flex justify-between">
          <div>
            <div><b>Item:</b> {item.code} - {item.name}</div>
            <div><b>Satuan:</b> {item.baseUnit}</div>
          </div>
          <div className="text-right">
            <div><b>Periode:</b> {startDate} s/d {endDate}</div>
            <div><b>Gudang:</b> {whName}</div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">

          {/* HEADER */}
          <thead className="sticky top-0 z-10 bg-gray-300">
            <tr>
              <th className="border px-2 py-1 w-24 sticky left-0 bg-gray-300 z-20">Tanggal</th>
              <th className="border px-2 py-1 w-32">Ref</th>
              <th className="border px-2 py-1 w-32">Gudang</th>
              <th className="border px-2 py-1 w-20">Tipe</th>
              <th className="border px-2 py-1">Keterangan</th>
              <th className="border px-2 py-1 w-24 text-right">Masuk</th>
              <th className="border px-2 py-1 w-24 text-right">Keluar</th>
              <th className="border px-2 py-1 w-28 text-right">Saldo</th>
            </tr>
          </thead>

          <tbody>

            {/* OPENING BALANCE */}
            <tr className="bg-gray-100">
              <td className="border px-2 py-1 sticky left-0 bg-gray-100 z-10">
                {startDate}
              </td>
              <td className="border px-2 py-1 italic">SALDO AWAL</td>
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1 italic">Saldo Awal Periode</td>
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1"></td>
              <td className="border px-2 py-1 text-right font-bold">
                {openingBalance.toLocaleString()}
              </td>
            </tr>

            {/* DATA */}
            {rows.map((r, i) => (
              <tr
                key={r.id}
                onClick={() => setActiveIndex(i)}
                className={`
                  cursor-pointer
                  ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  ${r.balance < 0 ? 'bg-red-100' : ''}
                  ${activeIndex === i ? 'bg-blue-200' : ''}
                  hover:bg-blue-100
                `}
              >
                <td className="border px-2 py-1 sticky left-0 bg-inherit z-10">
                  {r.date}
                </td>

                <td className="border px-2 py-1">{r.ref}</td>
                <td className="border px-2 py-1">{r.wh}</td>
                <td className="border px-2 py-1 text-center">{r.type}</td>
                <td className="border px-2 py-1">{r.note}</td>

                <td className="border px-2 py-1 text-right">
                  {r.inQty > 0 ? r.inQty.toLocaleString() : ''}
                </td>

                <td className="border px-2 py-1 text-right">
                  {r.outQty > 0 ? r.outQty.toLocaleString() : ''}
                </td>

                <td className={`border px-2 py-1 text-right font-bold ${
                  r.balance < 0 ? 'text-red-600' : ''
                }`}>
                  {r.balance.toLocaleString()}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400 italic">
                  Tidak ada data
                </td>
              </tr>
            )}

          </tbody>

          {/* FOOTER */}
          <tfoot className="sticky bottom-0 bg-gray-200">
            <tr>
              <td colSpan={5} className="border px-2 py-1 text-right font-bold">
                TOTAL PERIODE
              </td>
              <td className="border px-2 py-1 text-right font-bold">
                {summary.totalIn.toLocaleString()}
              </td>
              <td className="border px-2 py-1 text-right font-bold">
                {summary.totalOut.toLocaleString()}
              </td>
              <td className="border px-2 py-1 text-right font-bold">
                {summary.closing.toLocaleString()}
              </td>
            </tr>
          </tfoot>

        </table>
      </div>
    </div>
  );
};
