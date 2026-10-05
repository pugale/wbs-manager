import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WbsNode } from "../models/WbsTask";
import { formatIt, isInRitardo } from "../utils/dateUtils";
import { coloreDaNome, iniziali } from "../utils/personUtils";
import { coloreAvanzamento } from "../utils/avanzamentoUtils";
import { ICONA_TIPO_TASK } from "../utils/tipiTaskUtils";

function TaskNode({ data, selected }: NodeProps<WbsNode>) {
  const ritardo = isInRitardo(data);
  const responsabile = (data.responsabile ?? "").trim();
  const colore = coloreAvanzamento(data.percentuale);

  const classi = ["task-node", selected ? "is-selected" : "", ritardo ? "is-late" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classi} style={{ borderColor: colore }}>
      <Handle
        id="target-top"
        className="task-node__handle task-node__handle--target"
        type="target"
        position={Position.Top}
        style={{ left: "40%" }}
      />
      <Handle
        id="source-top"
        className="task-node__handle task-node__handle--source"
        type="source"
        position={Position.Top}
        style={{ left: "60%" }}
      />
      <Handle
        id="target-right"
        className="task-node__handle task-node__handle--target"
        type="target"
        position={Position.Right}
        style={{ top: "40%" }}
      />
      <Handle
        id="source-right"
        className="task-node__handle task-node__handle--source"
        type="source"
        position={Position.Right}
        style={{ top: "60%" }}
      />
      <Handle
        id="target-bottom"
        className="task-node__handle task-node__handle--target"
        type="target"
        position={Position.Bottom}
        style={{ left: "40%" }}
      />
      <Handle
        id="source-bottom"
        className="task-node__handle task-node__handle--source"
        type="source"
        position={Position.Bottom}
        style={{ left: "60%" }}
      />
      <Handle
        id="target-left"
        className="task-node__handle task-node__handle--target"
        type="target"
        position={Position.Left}
        style={{ top: "40%" }}
      />
      <Handle
        id="source-left"
        className="task-node__handle task-node__handle--source"
        type="source"
        position={Position.Left}
        style={{ top: "60%" }}
      />

      <div className="task-node__title" title={data.titolo}>
        <span className="task-node__type-icon" title={data.tipoTask} aria-label={data.tipoTask}>
          {ICONA_TIPO_TASK[data.tipoTask]}
        </span>
        <span className="ellipsis">{data.titolo}</span>
      </div>

      <div className="task-node__owner">
        {responsabile ? (
          <>
            <span
              className="avatar"
              title={responsabile}
              style={{ background: coloreDaNome(responsabile) }}
            >
              {iniziali(responsabile)}
            </span>
            <span className="ellipsis">{responsabile}</span>
          </>
        ) : (
          <span className="muted">Nessun responsabile</span>
        )}
      </div>

      <div className="task-node__dates">
        <span><strong>Inizio</strong> {formatIt(data.dataInizio)}</span>
        <span><strong>Fine</strong> {formatIt(data.dataFine)}</span>
      </div>

      <div className="task-node__progress-row">
        <div className="progress">
          <div
            className="progress__bar"
            style={{ width: `${data.percentuale}%`, background: colore }}
          />
        </div>
        <span className="task-node__percentage">{data.percentuale}%</span>
      </div>

      {ritardo && <div className="task-node__late">In ritardo</div>}
    </div>
  );
}

export default memo(TaskNode);
