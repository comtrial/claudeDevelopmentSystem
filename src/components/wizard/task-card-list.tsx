"use client";

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizard-store";
import type { ParsedTask } from "@/types/wizard";
import { TaskCard } from "./task-card";

export function TaskCardList() {
  const tasks = useWizardStore((s) => s.tasks);
  const setTasks = useWizardStore((s) => s.setTasks);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const next = [...tasks];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      setTasks(reorder(next));
    },
    [tasks, setTasks]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= tasks.length - 1) return;
      const next = [...tasks];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      setTasks(reorder(next));
    },
    [tasks, setTasks]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const next = tasks.filter((_, i) => i !== index);
      setTasks(reorder(next));
    },
    [tasks, setTasks]
  );

  const handleAdd = useCallback(() => {
    const newTask: ParsedTask = {
      id: crypto.randomUUID(),
      title: "새 작업",
      description: "",
      agent_role: "engineer",
      order: tasks.length + 1,
    };
    setTasks([...tasks, newTask]);
  }, [tasks, setTasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        작업을 분석하면 Task 카드가 여기에 표시됩니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            <TaskCard
              task={task}
              isFirst={index === 0}
              isLast={index === tasks.length - 1}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onDelete={() => handleDelete(index)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <Button
        variant="outline"
        size="sm"
        className="mt-1 self-start"
        onClick={handleAdd}
      >
        <Plus />
        작업 추가
      </Button>
    </div>
  );
}

function reorder(tasks: ParsedTask[]): ParsedTask[] {
  return tasks.map((t, i) => ({ ...t, order: i + 1 }));
}
