import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Thông tin chính sách (bản dự thảo) | Bàn Gọn',
  description: 'Thông tin demo và các mục chính sách đang chờ chủ shop phê duyệt.',
}

const requiredApprovals = [
  'Tên pháp nhân/chủ thể bán hàng, địa chỉ và thông tin liên hệ đã xác minh.',
  'Phạm vi giao hàng, thời gian dự kiến, phí và ngoại lệ được chủ shop xác nhận.',
  'Điều kiện đổi trả/bảo hành và quy trình tiếp nhận khiếu nại.',
  'Mục đích, căn cứ, thời hạn lưu trữ, quyền và đầu mối xử lý dữ liệu cá nhân.',
]

export default function PoliciesPage() {
  return <div className="container policies-page">
    <p className="eyebrow">BẢN DỰ THẢO NỘI BỘ</p>
    <h1>Thông tin và chính sách</h1>
    <p className="policy-warning" role="note">Đây chưa phải chính sách áp dụng cho khách hàng. Shop chưa mở bán, chưa nhận đơn thật; các nội dung giao hàng/ưu đãi hiện trên website là dữ liệu demo.</p>
    <section aria-labelledby="demo-facts"><h2 id="demo-facts">Thông tin bản demo</h2><p>Phí giao hàng 30.000đ và ngưỡng miễn phí 500.000đ chỉ là fixture kiểm thử, không phải cam kết bán hàng. Thuế demo bằng 0 và COD chưa thu tiền; không có giao dịch thật.</p></section>
    <section aria-labelledby="approval-needed"><h2 id="approval-needed">Cần chủ shop xác nhận trước khi công bố</h2><ul>{requiredApprovals.map((item) => <li key={item}>{item}</li>)}</ul></section>
  </div>
}
