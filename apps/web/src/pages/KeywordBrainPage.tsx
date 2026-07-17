import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2, Sparkles, Star, X, Trash2, ExternalLink, Brain, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 데이터 계약 ───────────────────────────────────────────────
interface KeywordItem {
  id: number;
  rank: number;
  keyword: string;
  category: string | null;
  type: string | null;
  status: string;
  scores: { final: number | null };
  metrics: { naverMonthlySearches: number | null; googleMonthlySearches: number | null };
}
interface CitationItem {
  keyword: string;
  citedCount: number | null;
}

type Group = "추천" | "저장" | "트렌드" | "인용";
const GROUP_COLOR: Record<Group, number> = {
  추천: 0x3b82f6, // 파랑(기본 계열)
  저장: 0xf59e0b, // 앰버(별표)
  트렌드: 0x10b981, // 에메랄드
  인용: 0x22d3ee, // 시안
};
const GROUP_HEX: Record<Group, string> = { 추천: "#3b82f6", 저장: "#f59e0b", 트렌드: "#10b981", 인용: "#22d3ee" };

interface BrainNode {
  key: string;
  label: string;
  id: number | null; // keyword.id (액션 가능)
  status: string | null;
  category: string | null;
  groups: Set<Group>;
  weight: number; // 0..1
  naver: number | null;
  google: number | null;
  cited: number | null;
  final: number | null;
  pos: THREE.Vector3;
}

// 결정적 의사난수 (Math.random 없이 재현 가능한 배치)
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function KeywordBrainPage() {
  const qc = useQueryClient();
  const now = new Date();

  const today = useQuery({ queryKey: ["kb-today"], queryFn: () => api.get<{ items: KeywordItem[] }>("/api/keywords/today") });
  const saved = useQuery({ queryKey: ["kb-saved"], queryFn: () => api.get<{ items: KeywordItem[] }>("/api/keywords/saved") });
  const trends = useQuery({
    queryKey: ["kb-trends", now.getFullYear(), now.getMonth() + 1],
    queryFn: () =>
      api.get<{ items: Array<{ keywordText: string; date: string; rank: number | null }> }>(
        `/api/keywords/trends?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      ),
  });
  const cites = useQuery({ queryKey: ["kb-cites"], queryFn: () => api.get<{ items: CitationItem[] }>("/api/keywords/citations") });

  const loading = today.isPending || saved.isPending || trends.isPending || cites.isPending;

  // ── 노드 병합 ────────────────────────────────────────────────
  const nodes = useMemo<BrainNode[]>(() => {
    const map = new Map<string, BrainNode>();
    const ensure = (label: string): BrainNode => {
      const key = label.trim();
      let n = map.get(key);
      if (!n) {
        n = {
          key,
          label: key,
          id: null,
          status: null,
          category: null,
          groups: new Set(),
          weight: 0,
          naver: null,
          google: null,
          cited: null,
          final: null,
          pos: new THREE.Vector3(),
        };
        map.set(key, n);
      }
      return n;
    };
    const addKw = (it: KeywordItem, g: Group) => {
      if (!it.keyword) return;
      const n = ensure(it.keyword);
      n.groups.add(g);
      n.id = it.id;
      n.status = it.status;
      n.category = it.category;
      n.naver = it.metrics?.naverMonthlySearches ?? n.naver;
      n.google = it.metrics?.googleMonthlySearches ?? n.google;
      n.final = it.scores?.final ?? n.final;
    };
    (today.data?.items ?? []).forEach((it) => addKw(it, "추천"));
    (saved.data?.items ?? []).filter((it) => it.status === "SAVED").forEach((it) => addKw(it, "저장"));
    // 트렌드: 한 달 내 여러 날 등장한 키워드 = 반복 이슈
    const seen = new Map<string, number>();
    (trends.data?.items ?? []).forEach((t) => seen.set(t.keywordText, (seen.get(t.keywordText) ?? 0) + 1));
    seen.forEach((days, kw) => {
      if (days >= 2) {
        const n = ensure(kw);
        n.groups.add("트렌드");
      }
    });
    (cites.data?.items ?? []).forEach((c) => {
      if (!c.keyword) return;
      const n = ensure(c.keyword);
      n.groups.add("인용");
      n.cited = (n.cited ?? 0) + (c.citedCount ?? 0);
    });

    const arr = [...map.values()].filter((n) => n.groups.size > 0);
    // 가중치 = 검색량/점수/인용 정규화 합
    const maxNaver = Math.max(1, ...arr.map((n) => n.naver ?? 0));
    const maxCited = Math.max(1, ...arr.map((n) => n.cited ?? 0));
    arr.forEach((n) => {
      const s1 = (n.naver ?? 0) / maxNaver;
      const s2 = (n.final ?? 0) / 100;
      const s3 = (n.cited ?? 0) / maxCited;
      n.weight = Math.min(1, 0.15 + 0.5 * s1 + 0.25 * s2 + 0.35 * s3);
    });
    // 상위 220개만 (성능)
    arr.sort((a, b) => b.weight - a.weight);
    const top = arr.slice(0, 220);

    // 두뇌 형태 배치 — 좌/우 반구 타원체 껍질 + 주름 노이즈
    top.forEach((n, i) => {
      const hemi = i % 2 === 0 ? -1 : 1;
      const u = rand(i + 1);
      const v = rand(i * 2 + 7);
      const theta = Math.acos(2 * u - 1);
      const phi = 2 * Math.PI * v;
      // 껍질(피질): 반경 0.82~1.0
      const shell = 0.82 + 0.18 * rand(i * 3 + 3);
      let x = Math.sin(theta) * Math.cos(phi);
      let y = Math.cos(theta);
      let z = Math.sin(theta) * Math.sin(phi);
      // 주름(고랑) — 표면 요철
      const fold = 0.12 * Math.sin(phi * 6 + theta * 5) * Math.sin(theta * 4);
      const r = shell + fold;
      // 타원체 반경 (앞뒤로 긴 뇌 형태) + 반구 분리
      x *= 1.15 * r;
      y *= 1.0 * r;
      z *= 1.5 * r;
      x += hemi * 0.42; // 좌우 반구 간격
      y += 0.15 * Math.sin(z * 1.5); // 살짝 아래로 처지는 곡률
      n.pos.set(x * 2.0, y * 2.0, z * 2.0);
    });
    return top;
  }, [today.data, saved.data, trends.data, cites.data]);

  // ── three.js 씬 ─────────────────────────────────────────────
  const mountRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<BrainNode | null>(null);
  const [labels, setLabels] = useState<Array<{ key: string; label: string; x: number; y: number; hot: boolean }>>([]);
  const selectedRef = useRef<BrainNode | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || nodes.length === 0) return;

    const width = () => mount.clientWidth;
    const height = () => mount.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1024);
    scene.fog = new THREE.FogExp2(0x0a1024, 0.03);

    const camera = new THREE.PerspectiveCamera(52, width() / height(), 0.1, 100);
    camera.position.set(0, 0.5, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 20;

    const group = new THREE.Group();
    scene.add(group);

    // 뉴런 발광 스프라이트 텍스처(방사형 그라데이션)
    const glow = document.createElement("canvas");
    glow.width = glow.height = 64;
    const gctx = glow.getContext("2d")!;
    const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.85)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(glow);

    // 뉴런 Points (per-node size/color/phase)
    const n = nodes.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const col = new THREE.Color();
    nodes.forEach((nd, i) => {
      positions[i * 3] = nd.pos.x;
      positions[i * 3 + 1] = nd.pos.y;
      positions[i * 3 + 2] = nd.pos.z;
      const primary = (["저장", "인용", "트렌드", "추천"] as Group[]).find((g) => nd.groups.has(g)) ?? "추천";
      col.setHex(GROUP_COLOR[primary]);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      sizes[i] = 14 + nd.weight * 46;
      phases[i] = rand(i * 5 + 11) * 6.283;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const neuronMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTex: { value: glowTex }, uSel: { value: -1 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aPhase;
        varying vec3 vColor; varying float vGlow;
        uniform float uTime;
        void main(){
          vColor = aColor;
          float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + aPhase);
          vGlow = pulse;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * pulse * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vGlow;
        uniform sampler2D uTex;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor * (0.6 + vGlow*0.8), t.a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, neuronMat);
    group.add(points);

    // 시냅스(연결선) — 같은 그룹/근접 노드 연결, 발화 애니메이션
    const segs: number[] = [];
    const segSeed: number[] = [];
    for (let i = 0; i < n; i++) {
      // 각 노드에서 가까운 2개 연결(상위 가중치 위주)
      const a = nodes[i];
      const near: Array<{ j: number; d: number }> = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = a.pos.distanceToSquared(nodes[j].pos);
        if (d < 3.2) near.push({ j, d });
      }
      near.sort((p, q) => p.d - q.d);
      near.slice(0, 2).forEach(({ j }) => {
        if (j < i) return; // 중복 방지
        segs.push(a.pos.x, a.pos.y, a.pos.z, nodes[j].pos.x, nodes[j].pos.y, nodes[j].pos.z);
        const s = rand(i * 13 + j);
        segSeed.push(s, s);
      });
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    lineGeo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(segSeed), 1));
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2f6fe0) } },
      vertexShader: `
        attribute float aSeed; varying float vSeed;
        void main(){ vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying float vSeed; uniform float uTime; uniform vec3 uColor;
        void main(){
          float fire = pow(sin(uTime*1.5 + vSeed*6.283)*0.5+0.5, 4.0);
          gl_FragColor = vec4(uColor, 0.05 + 0.5*fire);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    // 레이캐스트 클릭
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.35 };
    const mouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(points);
      if (hit.length > 0 && hit[0].index != null) setSelected(nodes[hit[0].index]);
    };
    renderer.domElement.addEventListener("click", onClick);

    // 라벨 오버레이 — 상위 가중치 + 선택 노드만
    const labelIdx = nodes
      .map((_, i) => i)
      .sort((a, b) => nodes[b].weight - nodes[a].weight)
      .slice(0, 16);

    const clock = new THREE.Clock();
    let raf = 0;
    const tmp = new THREE.Vector3();
    const render = () => {
      raf = requestAnimationFrame(render);
      const t = clock.getElapsedTime();
      neuronMat.uniforms.uTime.value = t;
      lineMat.uniforms.uTime.value = t;
      controls.update();
      renderer.render(scene, camera);

      // 라벨 위치 계산(선택 노드는 항상)
      const selNode = selectedRef.current;
      const idxs = new Set(labelIdx);
      if (selNode) {
        const si = nodes.indexOf(selNode);
        if (si >= 0) idxs.add(si);
      }
      const w = width();
      const h = height();
      const out: Array<{ key: string; label: string; x: number; y: number; hot: boolean }> = [];
      idxs.forEach((i) => {
        const nd = nodes[i];
        tmp.copy(nd.pos).applyMatrix4(group.matrixWorld).project(camera);
        if (tmp.z > 1) return;
        out.push({
          key: nd.key,
          label: nd.label,
          x: (tmp.x * 0.5 + 0.5) * w,
          y: (-tmp.y * 0.5 + 0.5) * h,
          hot: selNode === nd,
        });
      });
      setLabels(out);
    };
    render();

    const onResize = () => {
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
      renderer.setSize(width(), height());
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      geo.dispose();
      lineGeo.dispose();
      neuronMat.dispose();
      lineMat.dispose();
      glowTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [nodes]);

  // ── 액션 ─────────────────────────────────────────────────────
  const status = useMutation({
    mutationFn: (v: { id: number; status: string }) => api.patch(`/api/keywords/${v.id}/status`, { status: v.status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-today"] });
      qc.invalidateQueries({ queryKey: ["kb-saved"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });
  const discover = useMutation({
    mutationFn: () => api.post("/api/keywords/discover", {}),
    onSuccess: () => {
      toast.success("키워드를 새로 발굴했습니다.");
      qc.invalidateQueries({ queryKey: ["kb-today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패"),
  });

  const counts = useMemo(() => {
    const c: Record<Group, number> = { 추천: 0, 저장: 0, 트렌드: 0, 인용: 0 };
    nodes.forEach((nd) => nd.groups.forEach((g) => c[g]++));
    return c;
  }, [nodes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="size-6 text-[#3b82f6]" /> 키워드 두뇌
          </h1>
          <p className="text-sm text-muted-foreground">
            오늘의 추천·저장·트렌드·AI 인용을 하나의 신경망으로 — 노드를 클릭해 자세히 보세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/keywords/list">
            <Button variant="ghost" size="sm">표로 보기</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => discover.mutate()} disabled={discover.isPending}>
            {discover.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            키워드 발굴
          </Button>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {(Object.keys(GROUP_HEX) as Group[]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: GROUP_HEX[g], boxShadow: `0 0 8px ${GROUP_HEX[g]}` }} />
            {g} <span className="text-muted-foreground">{counts[g]}</span>
          </span>
        ))}
        <span className="text-muted-foreground">· 총 {nodes.length}개 뉴런</span>
      </div>

      <div className="relative grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* 3D 캔버스 */}
        <div className="relative overflow-hidden rounded-xl border bg-[#0a1024]" style={{ height: "min(72vh, 640px)" }}>
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-300">
              <Loader2 className="size-6 animate-spin" /> <span className="ml-2 text-sm">신경망 구성 중…</span>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
              <Brain className="size-10 opacity-40" />
              <p className="text-sm">아직 키워드가 없습니다. ‘키워드 발굴’을 눌러보세요.</p>
            </div>
          ) : (
            <>
              <div ref={mountRef} className="absolute inset-0" />
              {/* 라벨 오버레이 */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {labels.map((l) => (
                  <span
                    key={l.key}
                    className={
                      "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors " +
                      (l.hot ? "bg-white text-slate-900" : "bg-black/40 text-slate-100")
                    }
                    style={{ left: l.x, top: l.y - 14 }}
                  >
                    {l.label}
                  </span>
                ))}
              </div>
              <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-slate-400">
                드래그 회전 · 휠 확대
              </div>
            </>
          )}
        </div>

        {/* 사이드 패널 */}
        <div className="rounded-xl border bg-card p-4">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {[...selected.groups].map((g) => (
                    <Badge key={g} style={{ background: GROUP_HEX[g] }} className="text-white hover:opacity-90">
                      {g}
                    </Badge>
                  ))}
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold leading-snug">{selected.label}</h2>
              {selected.category && <div className="text-xs text-muted-foreground">{selected.category}</div>}

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="네이버 검색량" value={selected.naver} />
                <Metric label="구글 검색량" value={selected.google} />
                <Metric label="최종 점수" value={selected.final} suffix="점" />
                <Metric label="AI 인용" value={selected.cited} suffix="회" />
              </dl>

              <div className="flex flex-col gap-1.5 pt-1">
                {selected.id != null && (
                  <>
                    <Button
                      variant={selected.status === "SAVED" ? "secondary" : "default"}
                      size="sm"
                      onClick={() =>
                        status.mutate({ id: selected.id!, status: selected.status === "SAVED" ? "RECOMMENDED" : "SAVED" })
                      }
                      disabled={status.isPending}
                    >
                      <Star className={"size-4 " + (selected.status === "SAVED" ? "fill-current text-amber-500" : "")} />
                      {selected.status === "SAVED" ? "저장 해제" : "저장"}
                    </Button>
                    <Link to={`/keywords/${selected.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="size-4" /> 상세·추이 보기
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (confirm(`'${selected.label}' 키워드를 제외할까요?`))
                          status.mutate({ id: selected.id!, status: "EXCLUDED" });
                      }}
                      disabled={status.isPending}
                    >
                      <Trash2 className="size-4" /> 제외(삭제)
                    </Button>
                  </>
                )}
                {selected.id == null && (
                  <p className="text-xs text-muted-foreground">
                    이 키워드는 인용/트렌드 기록에서 왔습니다. 추천/저장 목록에 있으면 액션이 활성화됩니다.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Sparkles className="size-8 opacity-40" />
              <p className="text-sm">뉴런(키워드)을 클릭하면
                <br />지표·추이·액션이 여기 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">
        {value == null ? "—" : value.toLocaleString() + (suffix ?? "")}
      </dd>
    </div>
  );
}
