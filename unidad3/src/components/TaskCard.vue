<script setup>
import { computed } from "vue";

const props = defineProps({
    task: {
        type: Object,
        required: true
    },
    pending: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(["edit", "remove", "archive", "change-state"]);
const stateLabels = {
    pendiente: "Pendiente",
    en_progreso: "En progreso",
    completado: "Completada"
};
const priorityLabels = {
    baja: "Baja",
    media: "Media",
    alta: "Alta"
};
const nextState = computed(() => ({
    pendiente: "en_progreso",
    en_progreso: "completado",
    completado: "pendiente"
}[props.task.estado]));
const dateLabel = computed(() => {
    const date = new Date(props.task.fechaCreacion);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return new Intl.DateTimeFormat("es-EC", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
});
</script>

<template>
    <article class="task-card" :class="{ 'task-card--done': task.estado === 'completado' }">
        <div class="task-card-top">
            <span class="task-state" :class="`task-state--${task.estado}`">
                {{ stateLabels[task.estado] }}
            </span>
            <span class="task-priority" :class="`task-priority--${task.prioridad}`">
                Prioridad {{ priorityLabels[task.prioridad] }}
            </span>
        </div>
        <h3>{{ task.titulo }}</h3>
        <p v-if="task.descripcion" class="task-description">{{ task.descripcion }}</p>
        <p v-else class="task-description task-description--empty">Sin descripción adicional.</p>
        <div class="task-card-footer">
            <span class="task-date">{{ dateLabel }}</span>
            <div class="task-actions">
                <button
                    class="icon-button"
                    type="button"
                    :disabled="pending"
                    :aria-label="`Cambiar ${task.titulo} a ${stateLabels[nextState]}`"
                    @click="emit('change-state', task, nextState)"
                >
                    {{ task.estado === "completado" ? "Reabrir" : "Avanzar" }}
                </button>
                <button
                    class="icon-button"
                    type="button"
                    :disabled="pending"
                    :aria-label="`Editar ${task.titulo}`"
                    @click="emit('edit', task)"
                >
                    Editar
                </button>
                <button
                    class="icon-button icon-button--quiet"
                    type="button"
                    :disabled="pending"
                    :aria-label="`Archivar ${task.titulo}`"
                    @click="emit('archive', task)"
                >
                    Archivar
                </button>
                <button
                    class="icon-button icon-button--danger"
                    type="button"
                    :disabled="pending"
                    :aria-label="`Eliminar ${task.titulo}`"
                    @click="emit('remove', task)"
                >
                    Eliminar
                </button>
            </div>
        </div>
    </article>
</template>
