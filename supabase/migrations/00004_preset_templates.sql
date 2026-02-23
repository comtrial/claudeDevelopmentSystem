CREATE TABLE public.preset_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'FileSearch',
  config JSONB NOT NULL DEFAULT '{}',
  is_preset BOOLEAN DEFAULT true,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.preset_templates (id, title, description, icon, config, is_preset) VALUES
('code-review', '코드 리뷰', 'PR 단위 코드 리뷰 자동화', 'FileSearch',
 '{"agents": [{"role": "pm"}, {"role": "engineer"}, {"role": "reviewer"}], "mode": "review"}', true),
('analysis', '분석 & 계획', '코드베이스 분석 후 실행 계획 수립', 'Search',
 '{"agents": [{"role": "pm"}, {"role": "engineer"}], "mode": "plan_only"}', true),
('refactoring', '리팩토링 & 개선', '기존 코드 자동 리팩토링', 'RefreshCw',
 '{"agents": [{"role": "engineer"}, {"role": "reviewer"}], "mode": "auto_edit"}', true);

ALTER TABLE public.preset_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view presets" ON public.preset_templates FOR SELECT
  USING (is_preset = true OR user_id = auth.uid());
CREATE POLICY "Users can create own templates" ON public.preset_templates FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_preset = false);
CREATE POLICY "Users can update own templates" ON public.preset_templates FOR UPDATE
  USING (user_id = auth.uid() AND is_preset = false);
CREATE POLICY "Users can delete own templates" ON public.preset_templates FOR DELETE
  USING (user_id = auth.uid() AND is_preset = false);
