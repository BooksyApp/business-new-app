import { useState } from "react";
import { Bell, CalendarDays, Check, Inbox, Plus, TriangleAlert, Users, X, MoreHorizontal } from "lucide-react";
import {
  Avatar, AvatarStack, Btn, Card, CheckRow, Chip, ChipRow, ConfirmDialog, DataTable, Dialog, Drawer, EmptyState, ErrorState, Field,
  FormGrid, FormSection, IconBadge, Legend, Note, PageHead, Panel, RadioGroup, RoleChip, RowItem, RowMenu, SectionCard, SegPills, Shell,
  Sheet, Sidebar, Skeleton, StatusPill, Tabs, Tag, Tile, Tiles, Toggle, Toolbar, BzScope,
} from "@/components/bz";

/** Hidden dev route /bz-kit: one example of each kit component (visual self-check). Not in navigation. */
export default function BzKitPage() {
  const [tab, setTab] = useState("a");
  const [seg, setSeg] = useState("x");
  const [on, setOn] = useState(true);
  const [chk, setChk] = useState(true);
  const [radio, setRadio] = useState("a");
  const [open, setOpen] = useState<null | "drawer" | "sheet" | "dialog" | "confirm">(null);
  const close = () => setOpen(null);
  const foot = (
    <>
      <Btn kind="ol" onClick={close}>Ləğv et</Btn>
      <Btn kind="v" onClick={close}>Saxla</Btn>
    </>
  );
  const rows = [
    { id: 1, n: "Nigar M.", s: "Manikür", st: "c" as const },
    { id: 2, n: "Aysel Ə.", s: "Saç", st: "w" as const },
  ];
  return (
    <BzScope>
      <Shell
        sidebar={
          <Sidebar
            switcher={<><Avatar initials="M" size={36} /><div><b>Salon</b><small>Filial</small></div></>}
            action={{ label: "Yeni rezerv", icon: <Plus className="ic" /> }}
            groups={[
              { items: [{ key: "c", label: "Təqvim", icon: <CalendarDays className="ic" />, active: true }, { key: "m", label: "Mesajlar", icon: <Inbox className="ic" /> }] },
              { heading: "BİZNES", items: [{ key: "u", label: "Müştərilər", icon: <Users className="ic" /> }] },
            ]}
            me={<><Avatar initials="L" size={36} /><div><b>Leyla</b><small>Sahib</small></div><IconBadge icon={<Bell className="ic" />} /></>}
          />
        }
      >
        <PageHead title="UI kit" sub="Artifact markup, real components" right={<Btn kind="v" icon={<Plus className="ic" />}>Əlavə et</Btn>} />
        <Toolbar>
          <Chip on>Hamısı</Chip>
          <Chip violet>Seçilmiş</Chip>
          <Tabs items={[{ key: "a", label: "Birinci" }, { key: "b", label: "İkinci" }]} value={tab} onChange={setTab} pill />
          <SegPills items={[{ key: "x", label: "Gün" }, { key: "y", label: "Həftə" }]} value={seg} onChange={setSeg} />
        </Toolbar>
        <Tiles cols={4}>
          <Tile label="Rezervlər" value="12" hint="bu gün" />
          <Tile label="Gəlir" value="— AZN" />
        </Tiles>
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <Card title="Card" help="Helper text">
            <div className="row gap8"><StatusPill kind="c">Təsdiqlənib</StatusPill><StatusPill kind="w">Gözləyir</StatusPill><StatusPill kind="x">Ləğv</StatusPill><Tag>0 / 12</Tag><RoleChip>Sahib</RoleChip><AvatarStack items={["N", "A", "S"]} /></div>
            <ChipRow><Chip>Bir</Chip><Chip violet>İki</Chip></ChipRow>
            <Legend items={[{ color: "#6f52ed", label: "Saç" }, { color: "#e83e63", label: "Dırnaq" }]} />
          </Card>
          <SectionCard n={1} title="Section" hint="Numbered section with helper text">
            <FormGrid cols={2}>
              <Field label="Ad" required hint="Hint"><input defaultValue="Nigar" /></Field>
              <Field label="Xəta" error="Məcburidir"><input /></Field>
            </FormGrid>
            <FormSection>Seçimlər</FormSection>
            <Toggle title="Aktiv" help="Toggle" checked={on} onChange={setOn} />
            <CheckRow label="Check" sub="sub" checked={chk} icon={<Check className="ic" />} onChange={setChk} />
            <RadioGroup title="Radio" options={[{ value: "a", label: "A", hint: "hint" }, { value: "b", label: "B" }]} value={radio} onChange={setRadio} />
            <Note kind="in">Info note</Note>
          </SectionCard>
          <Panel title="Rows" small="RowItem + DataTable">
            <RowItem left={<Avatar initials="N" size={44} />} title="Nigar M." sub="Manikür · 14:00" right={<StatusPill kind="c">OK</StatusPill>} />
            <DataTable columns={["Ad", "Xidmət", "Status"]} grid="1fr 1fr 120px" rows={rows} rowKey={(r) => r.id} render={(r) => [r.n, r.s, <StatusPill key="s" kind={r.st}>Status</StatusPill>]} rowActions={() => <RowMenu icon={<MoreHorizontal className="ic" />} />} />
          </Panel>
          <Card title="States">
            <EmptyState icon={<Inbox className="ic" />} title="Boşdur" text="Hələ heç nə yoxdur." action={<Btn kind="v">Əlavə et</Btn>} />
            <ErrorState icon={<TriangleAlert className="ic" />} title="Yükləmək olmadı" text="Yenidən cəhd edin." />
            <Skeleton />
          </Card>
          <div className="row gap8">
            <Btn kind="ol" onClick={() => setOpen("drawer")}>Drawer</Btn>
            <Btn kind="ol" onClick={() => setOpen("sheet")}>Sheet</Btn>
            <Btn kind="ol" onClick={() => setOpen("dialog")}>Dialog</Btn>
            <Btn kind="dg" onClick={() => setOpen("confirm")}>Confirm</Btn>
          </div>
        </div>
        {open === "drawer" && <Drawer title="Drawer" sub="Alt başlıq" onClose={close} closeIcon={<X className="ic" />} footer={foot}><Field label="Ad"><input /></Field></Drawer>}
        {open === "sheet" && <Sheet title="Sheet" sub="Dar" onClose={close} closeIcon={<X className="ic" />} footer={foot}><Field label="Ad"><input /></Field></Sheet>}
        {open === "dialog" && <Dialog title="Dialog" sub="Sub" onClose={close} footer={foot}><Field label="Ad"><input /></Field></Dialog>}
        {open === "confirm" && <ConfirmDialog title="Silinsin?" body="Bu əməliyyat geri qayıtmır." onClose={close} footer={<><Btn kind="ol" onClick={close}>Ləğv et</Btn><Btn kind="dg" onClick={close}>Sil</Btn></>} />}
      </Shell>
    </BzScope>
  );
}
