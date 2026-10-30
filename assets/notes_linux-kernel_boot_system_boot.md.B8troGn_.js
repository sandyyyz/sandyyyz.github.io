import{_ as n,o as a,c as e,a2 as p}from"./chunks/framework.CdvW4CUT.js";const u=JSON.parse('{"title":"系统启动流程","description":"","frontmatter":{},"headers":[],"relativePath":"notes/linux-kernel/boot/system_boot.md","filePath":"notes/linux-kernel/boot/system_boot.md"}'),l={name:"notes/linux-kernel/boot/system_boot.md"};function i(r,s,c,o,b,t){return a(),e("div",null,[...s[0]||(s[0]=[p(`<h1 id="系统启动流程" tabindex="-1">系统启动流程 <a class="header-anchor" href="#系统启动流程" aria-label="Permalink to &quot;系统启动流程&quot;">​</a></h1><h2 id="uefi" tabindex="-1">UEFI <a class="header-anchor" href="#uefi" aria-label="Permalink to &quot;UEFI&quot;">​</a></h2><p>系统上电后，跳转到一条固定地址执行，该地址存放了uefi-firmware程序，UEFI固件将完成CPU初始化、RAM初始化、pcie设备枚举等工作，尝试读取ESP中的efi程序，随后把该程序加载到内存进行执行。<br> 在x86_64平台上，UEFI约定默认启动文件路径为：</p><div class="language- vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>\\EFI\\BOOT\\BOOTX64.EFI</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br></div></div><h2 id="shim" tabindex="-1">shim <a class="header-anchor" href="#shim" aria-label="Permalink to &quot;shim&quot;">​</a></h2><p>UEFI开启Secure Boot后，不会执行任意.efi文件，而只会执行签名能够被固件信任数据库验证的EFI程序。多数PC出厂时预置了Microsoft UEFI CA等证书，但通常没有Ubuntu、Fedora、Debian等Linux发行版自己的证书。<br> 如果要求每个用户手动把发行版证书写入主板固件，部署和维护会非常困难。</p><p>Shim采用两级验证方式解决这一问题：</p><div class="language- vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>UEFI Firmware</span></span>
<span class="line"><span>    │</span></span>
<span class="line"><span>    │ 使用固件db中的证书验证</span></span>
<span class="line"><span>    ▼</span></span>
<span class="line"><span>shimx64.efi</span></span>
<span class="line"><span>    │</span></span>
<span class="line"><span>    │ 使用Shim内置的发行版证书或MOK验证</span></span>
<span class="line"><span>    ▼</span></span>
<span class="line"><span>grubx64.efi</span></span>
<span class="line"><span>    │</span></span>
<span class="line"><span>    │ 验证并加载</span></span>
<span class="line"><span>    ▼</span></span>
<span class="line"><span>Linux Kernel</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br></div></div><p>发行版首先构建一个体积较小、功能有限的shimx64.efi，在其中嵌入自己的公钥，然后让Shim本身获得固件能够信任的签名。<br> UEFI验证并执行Shim后，Shim不再要求后续程序必须直接受固件信任，而是使用自己内置的发行版证书或用户注册的MOK来验证grubx64.efi。<br> 这样，固件只需要信任Shim，发行版就可以自行管理GRUB及后续组件的签名。<br> Shim不是GRUB的必备前级，也不是Secure Boot本身，而是Linux发行版常用的一种Secure Boot适配方案。它的本质作用可以概括为：</p><div class="language- vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>让UEFI先信任Shim，</span></span>
<span class="line"><span>再由Shim信任发行版或用户签名的GRUB，</span></span>
<span class="line"><span>从而把固件的Secure Boot信任链延伸到Linux启动链。</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br></div></div><h2 id="bootloader" tabindex="-1">bootloader <a class="header-anchor" href="#bootloader" aria-label="Permalink to &quot;bootloader&quot;">​</a></h2><p>bootloader 的职责是找到 kernel 与 initrd，并将它们装入内存。在 bootloader 被载入内存执行后，首先需要初始化自己的执行环境，包括一个脚本解释器，之后会在固定的目录下寻找自己的配置文件，如 <code>/boot/grub/grub.cfg</code>。</p><p>GRUB 在自身启动并完成基本初始化后，通过 <code>prefix</code> 定位并执行 <code>$prefix/grub.cfg</code>，从中获得启动菜单、Kernel 和 initramfs 的位置、Kernel Command Line 及相关加载策略。</p><p>读取某个名为 grub.cfg 的外部文件并非协议上的硬性要求，但 GRUB 必须以某种方式获得等价的启动命令；外部 grub.cfg 只是通用系统中最灵活、最常用的实现方式。</p><p>随后，由 bootloader 的脚本解释器解析执行该配置文件。该配置文件实际上记录了 kernel、initrd 的路径，以及向 kernel 传递的参数等重要信息。当 bootloader 成功将 kernel 与 initrd 载入内存后，将执行流切换至内核。</p><h2 id="kernel" tabindex="-1">kernel <a class="header-anchor" href="#kernel" aria-label="Permalink to &quot;kernel&quot;">​</a></h2><p>kernel首先完成内存、中断、调度、设备模型、驱动等初始化，此时内核可以正确管理CPU和内存。但是，由于驱动包含：</p><ol><li>编译进vmlinuz的驱动(built-in),在载入内核后可以执行。</li><li>以module形式存在于rootfs内的驱动,需要从rootfs内载入内存后执行。</li></ol><p>此时由于缺少必要的nvme等磁盘驱动，很可能还无法访问rootfs。</p><hr><p>Q: 为什么不直接将必要的驱动提前编译进内核？<br> A: 因为仅靠内建驱动无法优雅地解决通用硬件适配、模块化维护以及复杂存储初始化问题。固定硬件、简单根设备的系统可以将必要驱动内建并省略initramfs；通用发行版则通常采用“较通用的内核＋模块化驱动＋initramfs早期用户空间”，以获得更好的通用性、灵活性和可维护性。</p><hr><h2 id="initrd-initramfs" tabindex="-1">initrd/initramfs <a class="header-anchor" href="#initrd-initramfs" aria-label="Permalink to &quot;initrd/initramfs&quot;">​</a></h2><p>initrd和initramfs实际上是两个为了实现相同目的而设计的不同机制。<br> initrd-initial ram disk, 将文件系统镜像放入内存并模拟成块设备，内核需要具体文件系统驱动将其挂载。<br> 而initramfs-initial ram filesystem,将文件系统通过CPIO归档，内核可以将其解包到内存中的rootfs， 不需要经过块设备层。<br> 目前initrd基本已经由initramfs代替。<br> initramfs本质上是一个能够独立运行的、位于内存中的最小用户空间，其内容只需要满足一个目标：让内核能够找到、准备并挂载真正的RootFS，然后把启动流程交给真实根文件系统中的PID 1。</p><p>内核识别initramfs缓冲区，将其中的CPIO归档解压到rootfs，于是initramfs中的目录和文件成为当前可见的根目录.</p><div class="language- vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>/</span></span>
<span class="line"><span>├── init</span></span>
<span class="line"><span>├── bin/</span></span>
<span class="line"><span>├── sbin/</span></span>
<span class="line"><span>├── lib/</span></span>
<span class="line"><span>├── lib64/</span></span>
<span class="line"><span>├── lib/modules/&lt;kernel-version&gt;/</span></span>
<span class="line"><span>├── dev/</span></span>
<span class="line"><span>├── proc/</span></span>
<span class="line"><span>├── sys/</span></span>
<span class="line"><span>├── run/</span></span>
<span class="line"><span>├── etc/</span></span>
<span class="line"><span>└── usr/</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br></div></div><p>其中最关键的是根目录下的 <code>/init</code>。它是 initramfs 阶段的入口程序，内核完成自身初始化后会尝试执行它。</p><p><code>/init</code> 可以是 Shell 脚本、BusyBox 程序，也可以是 systemd 或 dracut 提供的初始化程序；它负责组织整个早期用户空间的启动流程：</p><ul><li><code>bin/</code>、<code>sbin/</code> 和 <code>usr/</code> 中通常包含 mount、modprobe、udevadm、blkid、fsck、switch_root 等必要工具，很多精简系统使用 BusyBox 统一提供这些命令；</li><li><code>lib/modules/&lt;kernel-version&gt;/</code> 保存访问根设备所需的内核模块，例如 NVMe、SCSI、VirtIO、USB 存储、RAID、Device Mapper 及文件系统模块；</li><li><code>lib/</code> 和 <code>lib64/</code> 保存动态链接库以及可能需要的固件；</li><li><code>etc/</code> 中则可能包含模块加载配置、udev 规则以及用于识别根设备、LVM、RAID 和加密卷的配置。</li></ul><p>initramfs 也可能包含 cryptsetup、LVM、mdadm、multipath、iSCSI 和网络配置工具，具体内容取决于真实 RootFS 的存储组织方式。</p><p>随后，内核结束内核态的初始化，并创建第一个用户进程。<code>/init</code> 的工作流程大致如下：</p><ol><li>读取内核命令行，尤其是 bootloader 通过 Linux command line 传入的参数，根据这些参数确定真正 rootfs 的位置和访问方式；</li><li>启动 udev 或等价的设备管理机制，触发设备枚举，并使用 modprobe 加载对应的内核模块；</li><li>驱动加载后，内核才能识别磁盘控制器及磁盘设备，并在 <code>/dev</code> 下产生相应设备节点；</li><li>当目标设备准备完成时，将真实的 rootfs 挂载，此时系统中存在两个根文件系统；</li><li>切换根文件系统，完成对旧根文件系统的清理，并在同一个 PID 1 进程上下文中通过 <code>execve()</code> 执行真实 RootFS 里的 <code>/sbin/init</code>。 整体流程概括如下：</li></ol><div class="language- vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>UEFI firmware</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>(shim, optional)</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>Bootloader</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>加载Kernel和initramfs</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>Kernel完成自身初始化</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>Kernel解压initramfs到rootfs</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>Kernel执行/init，产生早期用户空间PID 1</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>挂载/proc、/sys、/dev和/run</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>解析root=等内核命令行参数</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>加载存储及文件系统模块</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>识别磁盘、组装RAID、激活LVM或解锁LUKS</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>将真实RootFS挂载到/sysroot</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>switch_root</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>执行真实RootFS中的/sbin/init</span></span>
<span class="line"><span>    ↓</span></span>
<span class="line"><span>systemd作为PID 1继续启动系统服务</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br></div></div><p>至此，内核启动完成。</p><h2 id="补充" tabindex="-1">补充 <a class="header-anchor" href="#补充" aria-label="Permalink to &quot;补充&quot;">​</a></h2><p>“首次安装启动”与“安装后第一次启动”不能混为一谈。<br> 首次安装启动运行的是安装介质中的临时操作系统，其RootFS通常来自SquashFS、网络镜像或其他只读安装镜像；安装程序在这个临时系统里创建目标磁盘上的新系统。<br> 安装完成后的第一次重启，才会由目标磁盘上的EFI程序、GRUB、Kernel、initramfs和RootFS组成正常启动链路。<br> 区别可以概括为：</p><div class="language- vp-adaptive-theme line-numbers-mode"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>安装阶段：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>UEFI</span></span>
<span class="line"><span> → 安装介质Bootloader</span></span>
<span class="line"><span> → 安装介质Kernel</span></span>
<span class="line"><span> → 安装介质initramfs</span></span>
<span class="line"><span> → 安装介质临时RootFS</span></span>
<span class="line"><span> → 安装程序</span></span>
<span class="line"><span> → 创建目标磁盘系统</span></span>
<span class="line"><span></span></span>
<span class="line"><span>安装后正常启动：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>UEFI</span></span>
<span class="line"><span> → 目标磁盘Bootloader</span></span>
<span class="line"><span> → 目标磁盘Kernel</span></span>
<span class="line"><span> → 目标磁盘initramfs</span></span>
<span class="line"><span> → 目标磁盘RootFS</span></span>
<span class="line"><span> → systemd</span></span></code></pre><div class="line-numbers-wrapper" aria-hidden="true"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br></div></div><h2 id="todo" tabindex="-1">TODO <a class="header-anchor" href="#todo" aria-label="Permalink to &quot;TODO&quot;">​</a></h2><ol><li>edk2 source code</li><li>grub source code</li><li>linux source code (init/initramfs related)</li></ol>`,39)])])}const m=n(l,[["render",i]]);export{u as __pageData,m as default};
