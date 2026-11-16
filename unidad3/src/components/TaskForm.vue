<script setup>
import { reactive, watch } from "vue";

const props = defineProps({
    task: {
        type: Object,
        default: null
    },
    pending: {
        type: Boolean,
        default: false
    },
    error: {
        type: String,
        default: ""
    }
});

const emit = defineEmits(["submit", "cancel"]);
const form = reactive({
    titulo: "",
    descripcion: "",
    estado: "pendiente",
    prioridad: "media"
});

watch(() => props.task, (task) => {
    form.titulo = task?.titulo ?? "";
    form.descripcion = task?.descripcion ?? "";
    form.estado = task?.estado ?? "pendiente";
    form.prioridad = task?.prioridad ?? "media";
}, { immediate: true });

function submit() {
    emit("submit", { ...form });
}
</script>

<template>
    <form class="task-form" @submit.prevent="submit">
        <div class="form-heading">
            <div>
                <p class="eyebrow eyebrow-dark">{{ task ? "ACTUALIZAR" : "NUEVA ACTIVIDAD" }}</p>
                <h2>{{ task ? "Editar tarea" : "Añadir una tarea" }}</h2>
            </div>
            <span class="form-step" aria-hidden="true">{{ task ? "02" : "01" }}</span>
        </div>

        <label class="field">
            <span>Título <span aria-hidden="true">*</span></span>
            <input
                v-model="form.titulo"
                name="titulo"
                type="text"
                maxlength="120"
                autocomplete="off"
                required
                :disabled="pending"
                placeholder="Ej. Diseñar la primera pantalla"
            >
        </label>

        <label class="field">
            <span>Descripción</span>
            <textarea
                v-model="form.descripcion"
                name="descripcion"
                rows="3"
                maxlength="2000"
                :disabled="pending"
                placeholder="Contexto, alcance o siguiente paso"
            ></textarea>
        </label>

        <div class="field-row">
            <label class="field">
                <span>Estado</span>
                <select v-model="form.estado" name="estado" :disabled="pending">
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="completado">Completada</option>
                </select>
            </label>
            <label class="field">
                <span>Prioridad</span>
                <select v-model="form.prioridad" name="prioridad" :disabled="pending">
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                </select>
            </label>
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <div class="form-actions">
            <button class="button button-primary" type="submit" :disabled="pending">
                {{ pending ? "Guardando…" : task ? "Guardar cambios" : "Crear tarea" }}
            </button>
            <button
                v-if="task"
                class="button button-quiet"
                type="button"
                :disabled="pending"
                @click="$emit('cancel')"
            >
                Cancelar edición
            </button>
        </div>
    </form>
</template>
