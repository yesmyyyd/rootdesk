import RemoteControlClient from "@/components/remote/remote-control-client"

export default function RemoteControlPage() {
  return (
    <>
      {/* SEO Content for Search Engines like Baidu */}
      {/* <script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
      <script>
        var vConsole = new VConsole();
      </script>  */}
      <div className="sr-only">
        <h1>RootDesk - 专业远程控制与桌面管理平台</h1>
        <p>
          RootDesk 是一款高性能、安全可靠的远程控制解决方案，支持桌面管理、实时监控、文件传输与 IT 远程运维。
          适用于企业办公、远程技术支持及个人设备管理。
        </p>
        <ul>
          <li>远程桌面控制：极速画面传输，低延迟操作体验</li>
          <li>多终端管理：一键连接，高效管理您的所有设备</li>
          <li>文件传输：安全稳定的跨设备文件同步与传输</li>
          <li>实时监控：实时掌握设备状态与性能指标</li>
          <li>IT远程运维：专业的远程技术支持工具</li>
        </ul>
      </div>

      {/* Main Interactive Client Application */}
      <RemoteControlClient />
    </>
  )
}
