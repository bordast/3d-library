type Model = {
    id: string
    name: string
    format: string 
} 

export default function ModelCard({ model } : { model: Model }) {
    return (
        <a href={`/models/${model.id}`}>
            <div>
                <p>{model.name}</p>
                <span>{model.format}</span>
            </div>
        </a>
    )
}